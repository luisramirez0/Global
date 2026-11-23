package ar.global.odonto.usuario.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.auditoria.AuditLog;
import ar.global.odonto.auditoria.AuditLogRepository;
import ar.global.odonto.config.AppProperties;
import ar.global.odonto.security.DemasiadosIntentosException;
import ar.global.odonto.security.JwtConfig;
import ar.global.odonto.security.LoginRateLimiter;
import ar.global.odonto.security.PasswordConfig;
import ar.global.odonto.security.TokenService;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TestClockConfig;
import ar.global.odonto.usuario.Rol;
import ar.global.odonto.usuario.Usuario;
import ar.global.odonto.usuario.UsuarioRepository;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/** Spec authentication "Inicio de sesión" y "Auditoría del inicio de sesión" (design D6). */
@PersistenceTest
@Import({ LoginService.class, PasswordConfig.class, TokenService.class, JwtConfig.class, LoginRateLimiter.class })
@EnableConfigurationProperties(AppProperties.class)
@ExtendWith(OutputCaptureExtension.class)
class LoginServiceTest {

	private static final String EMAIL = "ana@consultorio.test";
	private static final String PASSWORD = "Segura123!";
	private static final String IP = "10.0.0.1";

	@Autowired
	private LoginService login;

	@Autowired
	private UsuarioRepository usuarios;

	@Autowired
	private AuditLogRepository auditoria;

	@Autowired
	private JwtDecoder decoder;

	@MockitoSpyBean
	private PasswordEncoder passwordEncoder;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private LoginRateLimiter limiter;

	private Long consultorioId;
	private Long usuarioId;

	@BeforeEach
	void setUp() {
		consultorioId = fixtures.createConsultorio("Consultorio A");
		usuarioId = fixtures.inTenant(consultorioId,
				() -> usuarios.save(new Usuario(EMAIL, passwordEncoder.encode(PASSWORD), "Ana", Rol.ADMIN)).getId());
		clearInvocations(passwordEncoder);
		// El contexto (y el limiter en memoria) se reutiliza entre tests.
		limiter.reset(LoginRateLimiter.clave(IP, EMAIL));
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	@Test
	void successfulLoginEmitsTokenUpdatesLastLoginAndAudits() {
		LoginResponse r = login.login(" ANA@consultorio.test ", PASSWORD, IP);

		assertThat(r.tokenType()).isEqualTo("Bearer");
		assertThat(r.expiresIn()).isEqualTo(1800);
		assertThat(r.consultorioId()).isEqualTo(consultorioId);
		assertThat(r.usuario().id()).isEqualTo(usuarioId);
		assertThat(r.usuario().nombre()).isEqualTo("Ana");
		assertThat(r.usuario().rol()).isEqualTo(Rol.ADMIN);
		assertThat(decoder.decode(r.accessToken()).getSubject()).isEqualTo(String.valueOf(usuarioId));
		fixtures.inTenant(consultorioId, () -> {
			assertThat(usuarios.findById(usuarioId).orElseThrow().getUltimoLogin()).isEqualTo(TestClockConfig.START);
			return null;
		});
		assertThat(audits()).singleElement().satisfies(a -> {
			assertThat(a.getAccion()).isEqualTo(AccionAuditoria.LOGIN);
			assertThat(a.getUsuarioId()).isEqualTo(usuarioId);
			assertThat(a.getConsultorioId()).isEqualTo(consultorioId);
			assertThat(a.getIp()).isEqualTo(IP);
			assertThat(a.getDetalle()).isEqualTo("ok");
		});
	}

	@Test
	void wrongPasswordIsRejectedAndAuditedAsFailed() {
		assertThatThrownBy(() -> login.login(EMAIL, "incorrecta", IP))
				.isInstanceOf(CredencialesInvalidasException.class);

		assertThat(audits()).singleElement().satisfies(a -> {
			assertThat(a.getAccion()).isEqualTo(AccionAuditoria.LOGIN);
			assertThat(a.getDetalle()).isEqualTo("fallido");
			assertThat(a.getDetalle()).doesNotContain(EMAIL);
		});
	}

	@Test
	void inactiveUserIsRejectedEvenWithTheRightPassword() {
		fixtures.inTenant(consultorioId, () -> {
			usuarios.findById(usuarioId).orElseThrow().setActivo(false);
			return null;
		});

		assertThatThrownBy(() -> login.login(EMAIL, PASSWORD, IP)).isInstanceOf(CredencialesInvalidasException.class);
	}

	@Test
	void unknownEmailIsRejectedWithoutAuditOrPiiAndStillHashes(CapturedOutput output) {
		assertThatThrownBy(() -> login.login("nadie@x.test", PASSWORD, IP))
				.isInstanceOf(CredencialesInvalidasException.class);

		assertThat(audits()).isEmpty();
		assertThat(output.getAll()).doesNotContain("nadie@x.test").doesNotContain(PASSWORD);
		verify(passwordEncoder, times(1)).matches(eq(PASSWORD), anyString());
	}

	@Test
	void sixthAttemptAfterFiveFailuresIsBlockedEvenWithTheRightPassword() {
		for (int i = 0; i < 5; i++) {
			assertThatThrownBy(() -> login.login(EMAIL, "incorrecta", IP))
					.isInstanceOf(CredencialesInvalidasException.class);
		}

		assertThatThrownBy(() -> login.login(EMAIL, PASSWORD, IP)).isInstanceOf(DemasiadosIntentosException.class);
	}

	@Test
	void successResetsTheFailureCounter() {
		for (int i = 0; i < 4; i++) {
			assertThatThrownBy(() -> login.login(EMAIL, "incorrecta", IP))
					.isInstanceOf(CredencialesInvalidasException.class);
		}
		login.login(EMAIL, PASSWORD, IP);
		for (int i = 0; i < 4; i++) {
			assertThatThrownBy(() -> login.login(EMAIL, "incorrecta", IP))
					.isInstanceOf(CredencialesInvalidasException.class);
		}

		assertThat(login.login(EMAIL, PASSWORD, IP).accessToken()).isNotBlank();
	}

	private List<AuditLog> audits() {
		return fixtures.inTenant(consultorioId, () -> auditoria.findAll(Pageable.unpaged()).getContent());
	}
}
