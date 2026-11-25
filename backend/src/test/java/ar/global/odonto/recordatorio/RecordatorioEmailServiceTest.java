package ar.global.odonto.recordatorio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.agenda.EstadoTurno;
import ar.global.odonto.agenda.Turno;
import ar.global.odonto.agenda.TurnoRepository;
import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.auditoria.AuditLog;
import ar.global.odonto.auditoria.AuditLogRepository;
import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.common.web.ConflictoException;
import ar.global.odonto.common.web.RecursoNoEncontradoException;
import ar.global.odonto.common.web.ReferenciaInvalidaException;
import ar.global.odonto.paciente.PacienteRepository;
import ar.global.odonto.recordatorio.email.EmailNoConfiguradoException;
import ar.global.odonto.recordatorio.email.EnvioEmailFallidoException;
import ar.global.odonto.recordatorio.email.FakeEnvioEmail;
import ar.global.odonto.testsupport.DomainFixtures;
import ar.global.odonto.testsupport.DomainFixtures.Graph;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import ar.global.odonto.testsupport.TestClockConfig;
import ar.global.odonto.testsupport.TestClockConfig.MutableClock;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * {@link RecordatorioEmailService} contra H2 {@code MODE=MySQL} real con un fake de {@link EnvioEmail} (C-09 tarea
 * 5.3). El seed de {@link DomainFixtures} da a A un turno {@code PROGRAMADO} el 2026-12-02 12:00Z (09:00 local).
 */
@SpringBootTest
@ExtendWith(OutputCaptureExtension.class)
@Import({ TenantFixtures.class, DomainFixtures.class, TestClockConfig.class, FakeEnvioEmail.class })
class RecordatorioEmailServiceTest {

	private static final Instant AHORA = Instant.parse("2026-11-25T14:00:00Z");
	private static final String EMAIL = "zoilo.quintanilla@paciente.test";
	private static final ObjectMapper JSON = new ObjectMapper();

	@Autowired
	private RecordatorioEmailService service;

	@Autowired
	private FakeEnvioEmail fake;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private DomainFixtures domain;

	@Autowired
	private PacienteRepository pacientes;

	@Autowired
	private RecordatorioRepository recordatorios;

	@Autowired
	private TurnoRepository turnos;

	@Autowired
	private AuditLogRepository auditLogs;

	@Autowired
	private JdbcTemplate jdbc;

	@Autowired
	private MutableClock clock;

	private Tenants tenants;
	private Graph a;
	private Graph b;

	@BeforeEach
	void setUp() {
		fixtures.cleanAll();
		clock.set(AHORA);
		fake.reset();
		tenants = fixtures.createTenants();
		a = domain.seed(tenants.a(), "a");
		b = domain.seed(tenants.b(), "b");
		jdbc.update("DELETE FROM recordatorio");
		conEmail(tenants.a(), a, EMAIL);
		conEmail(tenants.b(), b, EMAIL);
	}

	@AfterEach
	void cleanUp() {
		fake.reset();
		fixtures.cleanAll();
	}

	private void conEmail(Long tenant, Graph g, String email) {
		fixtures.inTenant(tenant, () -> {
			var p = pacientes.findById(g.paciente().getId()).orElseThrow();
			p.setEmail(email);
			return pacientes.save(p);
		});
	}

	private <T> T enA(Supplier<T> block) {
		return TenantContext.runAs(tenants.a(), block);
	}

	private List<Recordatorio> recordatoriosDe(Long tenant) {
		return fixtures.inTenant(tenant, () -> recordatorios.findAll());
	}

	private List<AuditLog> auditoriaRecordatorios(Long tenant) {
		return fixtures.inTenant(tenant, () -> auditLogs.findAll(Pageable.unpaged()).getContent().stream()
				.filter(l -> "Recordatorio".equals(l.getEntidad())).filter(l -> l.getAccion() == AccionAuditoria.CREATE)
				.toList());
	}

	@Test
	void successSendsOneEmailAndPersistsEnviadoWithClockInstantsBeforeAndAfterSending() {
		fake.alEnviar(() -> clock.advance(Duration.ofSeconds(3)));

		EmailEnviado res = enA(() -> service.enviar(a.turno().getId()));

		assertThat(fake.envios()).hasSize(1);
		FakeEnvioEmail.Envio envio = fake.envios().get(0);
		assertThat(envio.destinatario()).isEqualTo(EMAIL);
		assertThat(envio.asunto()).isEqualTo("Recordatorio de turno");
		assertThat(envio.texto()).isEqualTo(
				"Recordatorio: tiene un turno el 02/12/2026 a las 09:00 en Consultorio A con Prof Apellido a.");
		assertThat(res.estado()).isEqualTo(EstadoRecordatorio.ENVIADO);
		assertThat(res.enviadoEn()).isEqualTo(AHORA.plusSeconds(3));
		List<Recordatorio> guardados = recordatoriosDe(tenants.a());
		assertThat(guardados).hasSize(1);
		Recordatorio r = guardados.get(0);
		assertThat(r.getId()).isEqualTo(res.recordatorioId());
		assertThat(r.getCanal()).isEqualTo(CanalRecordatorio.EMAIL);
		assertThat(r.getEstado()).isEqualTo(EstadoRecordatorio.ENVIADO);
		assertThat(r.getGeneradoEn()).isEqualTo(AHORA);
		assertThat(r.getEnviadoEn()).isEqualTo(AHORA.plusSeconds(3));
		assertThat(r.getDetalleError()).isNull();
	}

	@Test
	void successWritesOneCreateAuditRowWithCanalAndEstadoOnly() throws Exception {
		EmailEnviado res = enA(() -> service.enviar(a.turno().getId()));

		List<AuditLog> filas = auditoriaRecordatorios(tenants.a());
		assertThat(filas).hasSize(1);
		AuditLog fila = filas.get(0);
		assertThat(fila.getEntidadId()).isEqualTo(res.recordatorioId());
		assertThat(JSON.readValue(fila.getDetalle(), new TypeReference<Map<String, Object>>() {
		})).isEqualTo(Map.of("canal", "EMAIL", "estado", "ENVIADO"));
		assertThat(fila.getDetalle()).doesNotContain(EMAIL).doesNotContain("Apellido");
		assertThat(auditoriaRecordatorios(tenants.b())).isEmpty();
	}

	@Test
	void emailIsSentWithNoActiveTransaction() {
		enA(() -> service.enviar(a.turno().getId()));

		assertThat(fake.envios()).hasSize(1);
		assertThat(fake.envios().get(0).transaccionActiva()).isFalse();
	}

	@Test
	void smtpFailurePersistsErrorWithFixedCodeAndRethrowsThePortException() {
		fake.fallaCon(new EnvioEmailFallidoException("SMTP_FALLO:MailSendException"));

		assertThatThrownBy(() -> enA(() -> service.enviar(a.turno().getId())))
				.isInstanceOf(EnvioEmailFallidoException.class);

		List<Recordatorio> guardados = recordatoriosDe(tenants.a());
		assertThat(guardados).hasSize(1);
		Recordatorio r = guardados.get(0);
		assertThat(r.getCanal()).isEqualTo(CanalRecordatorio.EMAIL);
		assertThat(r.getEstado()).isEqualTo(EstadoRecordatorio.ERROR);
		assertThat(r.getGeneradoEn()).isEqualTo(AHORA);
		assertThat(r.getEnviadoEn()).isNull();
		assertThat(r.getDetalleError()).isEqualTo("SMTP_FALLO:MailSendException");
	}

	@Test
	void smtpFailureWritesOneCreateAuditRowWithEstadoError() throws Exception {
		fake.fallaCon(new EnvioEmailFallidoException("SMTP_FALLO:MailSendException"));

		assertThatThrownBy(() -> enA(() -> service.enviar(a.turno().getId())))
				.isInstanceOf(EnvioEmailFallidoException.class);

		List<AuditLog> filas = auditoriaRecordatorios(tenants.a());
		assertThat(filas).hasSize(1);
		assertThat(filas.get(0).getEntidadId()).isEqualTo(recordatoriosDe(tenants.a()).get(0).getId());
		assertThat(JSON.readValue(filas.get(0).getDetalle(), new TypeReference<Map<String, Object>>() {
		})).isEqualTo(Map.of("canal", "EMAIL", "estado", "ERROR"));
		assertThat(filas.get(0).getDetalle()).doesNotContain(EMAIL).doesNotContain("SMTP");
	}

	@Test
	void smtpNotConfiguredPersistsErrorWithFixedCodeAuditsAndRethrows() throws Exception {
		fake.fallaCon(new EmailNoConfiguradoException());

		assertThatThrownBy(() -> enA(() -> service.enviar(a.turno().getId())))
				.isInstanceOf(EmailNoConfiguradoException.class);

		List<Recordatorio> guardados = recordatoriosDe(tenants.a());
		assertThat(guardados).hasSize(1);
		Recordatorio r = guardados.get(0);
		assertThat(r.getEstado()).isEqualTo(EstadoRecordatorio.ERROR);
		assertThat(r.getEnviadoEn()).isNull();
		assertThat(r.getDetalleError()).isEqualTo("SMTP_NO_CONFIGURADO");
		List<AuditLog> filas = auditoriaRecordatorios(tenants.a());
		assertThat(filas).hasSize(1);
		assertThat(JSON.readValue(filas.get(0).getDetalle(), new TypeReference<Map<String, Object>>() {
		})).isEqualTo(Map.of("canal", "EMAIL", "estado", "ERROR"));
	}

	@ParameterizedTest
	@NullSource
	@ValueSource(strings = { "", "   " })
	void missingEmailIsReferenciaInvalidaEmailWithNoSendNoRowNoAudit(String email) {
		conEmail(tenants.a(), a, email);

		assertThatThrownBy(() -> enA(() -> service.enviar(a.turno().getId())))
				.isInstanceOfSatisfying(ReferenciaInvalidaException.class,
						e -> assertThat(e.getCampo()).isEqualTo("email"));

		assertThat(fake.envios()).isEmpty();
		assertThat(recordatoriosDe(tenants.a())).isEmpty();
		assertThat(auditoriaRecordatorios(tenants.a())).isEmpty();
	}

	@ParameterizedTest
	@EnumSource(value = EstadoTurno.class, names = { "CANCELADO", "ASISTIO", "AUSENTE" })
	void nonRecordableStatesAreConflictWithNoSendNoRowNoAudit(EstadoTurno estado) {
		Turno turno = turno(tenants.a(), a, estado);

		assertThatThrownBy(() -> enA(() -> service.enviar(turno.getId()))).isInstanceOf(ConflictoException.class);

		assertThat(fake.envios()).isEmpty();
		assertThat(recordatoriosDe(tenants.a())).isEmpty();
		assertThat(auditoriaRecordatorios(tenants.a())).isEmpty();
	}

	@Test
	void confirmadoIsAlsoAccepted() {
		Turno confirmado = turno(tenants.a(), a, EstadoTurno.CONFIRMADO);

		EmailEnviado res = enA(() -> service.enviar(confirmado.getId()));

		assertThat(res.estado()).isEqualTo(EstadoRecordatorio.ENVIADO);
		assertThat(fake.envios()).hasSize(1);
	}

	@Test
	void unknownTurnoIsNotFoundWithNoSendNoRowNoAudit() {
		assertThatThrownBy(() -> enA(() -> service.enviar(999_999L))).isInstanceOf(RecursoNoEncontradoException.class);

		assertThat(fake.envios()).isEmpty();
		assertThat(recordatoriosDe(tenants.a())).isEmpty();
		assertThat(auditoriaRecordatorios(tenants.a())).isEmpty();
	}

	@Test
	void turnoOfAnotherTenantIsNotFoundWithNoSendAndNothingPersistedInEither() {
		assertThatThrownBy(() -> enA(() -> service.enviar(b.turno().getId())))
				.isInstanceOf(RecursoNoEncontradoException.class);

		assertThat(fake.envios()).isEmpty();
		assertThat(recordatoriosDe(tenants.a())).isEmpty();
		assertThat(recordatoriosDe(tenants.b())).isEmpty();
		assertThat(auditoriaRecordatorios(tenants.a())).isEmpty();
		assertThat(auditoriaRecordatorios(tenants.b())).isEmpty();
	}

	/** Design D13: el email ya salio, el registro refleja lo ocurrido aunque el turno se cancele mientras tanto. */
	@Test
	void turnoCancelledWhileSendingStillRecordsEnviado() {
		Long turnoId = a.turno().getId();
		fake.alEnviar(() -> fixtures.inTenant(tenants.a(), () -> {
			Turno t = turnos.findById(turnoId).orElseThrow();
			t.cambiarEstado(EstadoTurno.CANCELADO, "motivo");
			return turnos.save(t);
		}));

		EmailEnviado res = enA(() -> service.enviar(turnoId));

		assertThat(res.estado()).isEqualTo(EstadoRecordatorio.ENVIADO);
		assertThat(recordatoriosDe(tenants.a())).extracting(Recordatorio::getEstado)
				.containsExactly(EstadoRecordatorio.ENVIADO);
		assertThat(auditoriaRecordatorios(tenants.a())).hasSize(1);
	}

	@Test
	void persistedErrorCodeNeverExceeds500AndCarriesNoPersonalData() {
		fake.fallaCon(new EnvioEmailFallidoException("SMTP_FALLO:" + "X".repeat(900)));

		assertThatThrownBy(() -> enA(() -> service.enviar(a.turno().getId())))
				.isInstanceOf(EnvioEmailFallidoException.class);

		String detalle = recordatoriosDe(tenants.a()).get(0).getDetalleError();
		assertThat(detalle).hasSize(500).doesNotContain(EMAIL).doesNotContain("Apellido");
	}

	private Turno turno(Long tenant, Graph g, EstadoTurno estado) {
		return fixtures.inTenant(tenant, () -> {
			Turno t = new Turno(g.paciente(), g.profesional(), g.sillon(), g.prestacion(),
					Instant.parse("2026-12-03T12:00:00Z"), Instant.parse("2026-12-03T12:30:00Z"));
			t.cambiarEstado(estado, estado == EstadoTurno.CANCELADO ? "motivo" : null);
			return turnos.save(t);
		});
	}

	@Test
	void turnoVanishedBetweenSendAndPersistLogsIdAndClassNameAndPersistsNothing(CapturedOutput output) {
		Long turnoId = a.turno().getId();
		// El email "sale" y, antes del paso (c), el turno desaparece (borrado real en la BD, sin mocks).
		// La semilla enlaza una nota clinica al turno (FK): se la quita antes para que el borrado sea posible.
		fake.alEnviar(() -> {
			jdbc.update("DELETE FROM nota_clinica WHERE turno_id = ?", turnoId);
			jdbc.update("DELETE FROM turno WHERE id = ?", turnoId);
		});

		assertThatThrownBy(() -> enA(() -> service.enviar(turnoId))).isInstanceOf(IllegalStateException.class)
				.isNotInstanceOf(RecursoNoEncontradoException.class);

		assertThat(fake.envios()).hasSize(1);
		assertThat(output.getAll()).contains("turnoId=" + turnoId).contains("causa=IllegalStateException")
				.doesNotContain(EMAIL);
		assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM recordatorio", Long.class)).isZero();
		assertThat(auditoriaRecordatorios(tenants.a())).isEmpty();
	}
}
