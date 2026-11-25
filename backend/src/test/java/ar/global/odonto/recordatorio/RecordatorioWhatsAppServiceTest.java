package ar.global.odonto.recordatorio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.agenda.EstadoTurno;
import ar.global.odonto.agenda.Turno;
import ar.global.odonto.agenda.TurnoRepository;
import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.auditoria.AuditLog;
import ar.global.odonto.auditoria.AuditLogRepository;
import ar.global.odonto.auditoria.AuditService;
import ar.global.odonto.auditoria.ContextoAuditoria;
import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.common.web.ConflictoException;
import ar.global.odonto.common.web.RecursoNoEncontradoException;
import ar.global.odonto.common.web.ReferenciaInvalidaException;
import ar.global.odonto.paciente.PacienteRepository;
import ar.global.odonto.testsupport.DomainFixtures;
import ar.global.odonto.testsupport.DomainFixtures.Graph;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import ar.global.odonto.testsupport.TestClockConfig.MutableClock;
import java.time.Duration;
import java.time.Instant;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * {@link RecordatorioWhatsAppService} contra H2 {@code MODE=MySQL} (C-09 tareas 3.1 y 3.2). El seed de
 * {@link DomainFixtures} da a A un turno {@code PROGRAMADO} el 2026-12-02 12:00Z (09:00 en Buenos Aires).
 */
@PersistenceTest
@Import({ RecordatorioWhatsAppService.class, AuditService.class, ContextoAuditoria.class })
class RecordatorioWhatsAppServiceTest {

	private static final Instant AHORA = Instant.parse("2026-11-25T14:00:00Z");
	private static final ObjectMapper JSON = new ObjectMapper();
	private static final String TELEFONO = "+5491122334455";

	@Autowired
	private RecordatorioWhatsAppService service;

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
		tenants = fixtures.createTenants();
		a = domain.seed(tenants.a(), "a");
		b = domain.seed(tenants.b(), "b");
		jdbc.update("DELETE FROM recordatorio");
		conTelefono(tenants.a(), a, TELEFONO);
		conTelefono(tenants.b(), b, TELEFONO);
	}

	@AfterEach
	void cleanUp() {
		fixtures.cleanAll();
	}

	private void conTelefono(Long tenant, Graph g, String telefono) {
		fixtures.inTenant(tenant, () -> {
			var p = pacientes.findById(g.paciente().getId()).orElseThrow();
			p.setTelefono(telefono);
			return pacientes.save(p);
		});
	}

	private <T> T enA(Supplier<T> block) {
		return TenantContext.runAs(tenants.a(), block);
	}

	private List<Recordatorio> recordatoriosDe(Long tenant) {
		return fixtures.inTenant(tenant, () -> recordatorios.findAll());
	}

	@Test
	void programadoWithPhoneReturnsLinkAndPersistsGenerado() {
		Turno turno = a.turno();

		EnlaceGenerado res = enA(() -> service.generarEnlace(turno.getId()));

		assertThat(res.enlace()).isEqualTo("https://wa.me/5491122334455?text="
				+ "Recordatorio%3A%20tiene%20un%20turno%20el%2002%2F12%2F2026%20a%20las%2009%3A00%20en%20"
				+ "Consultorio%20A%20con%20Prof%20Apellido%20a.");
		assertThat(res.generadoEn()).isEqualTo(AHORA);
		List<Recordatorio> guardados = recordatoriosDe(tenants.a());
		assertThat(guardados).hasSize(1);
		Recordatorio r = guardados.get(0);
		assertThat(r.getId()).isEqualTo(res.recordatorioId());
		assertThat(r.getCanal()).isEqualTo(CanalRecordatorio.WHATSAPP_LINK);
		assertThat(r.getEstado()).isEqualTo(EstadoRecordatorio.GENERADO);
		assertThat(r.getGeneradoEn()).isEqualTo(AHORA);
		assertThat(r.getEnviadoEn()).isNull();
	}

	@Test
	void confirmadoIsAlsoAccepted() {
		Turno confirmado = turno(tenants.a(), a, EstadoTurno.CONFIRMADO);

		EnlaceGenerado res = enA(() -> service.generarEnlace(confirmado.getId()));

		assertThat(res.enlace()).startsWith("https://wa.me/5491122334455?text=");
		assertThat(recordatoriosDe(tenants.a())).hasSize(1);
	}

	@ParameterizedTest
	@EnumSource(value = EstadoTurno.class, names = { "CANCELADO", "ASISTIO", "AUSENTE" })
	void nonRecordableStatesAreConflictAndPersistNothing(EstadoTurno estado) {
		Turno turno = turno(tenants.a(), a, estado);

		assertThatThrownBy(() -> enA(() -> service.generarEnlace(turno.getId())))
				.isInstanceOf(ConflictoException.class);

		assertThat(recordatoriosDe(tenants.a())).isEmpty();
	}

	@ParameterizedTest
	@NullSource
	@ValueSource(strings = { "", "1122334455", "+54abc" })
	void missingOrInvalidPhoneIsReferenciaInvalidaTelefonoAndPersistsNothing(String telefono) {
		conTelefono(tenants.a(), a, telefono);

		assertThatThrownBy(() -> enA(() -> service.generarEnlace(a.turno().getId())))
				.isInstanceOfSatisfying(ReferenciaInvalidaException.class,
						e -> assertThat(e.getCampo()).isEqualTo("telefono"))
				.hasMessageNotContaining("1122");

		assertThat(recordatoriosDe(tenants.a())).isEmpty();
	}

	@Test
	void unknownTurnoIsNotFound() {
		assertThatThrownBy(() -> enA(() -> service.generarEnlace(999_999L)))
				.isInstanceOf(RecursoNoEncontradoException.class);

		assertThat(recordatoriosDe(tenants.a())).isEmpty();
	}

	@Test
	void turnoOfAnotherTenantIsNotFoundAndNothingIsPersistedInEither() {
		assertThatThrownBy(() -> enA(() -> service.generarEnlace(b.turno().getId())))
				.isInstanceOf(RecursoNoEncontradoException.class);

		assertThat(recordatoriosDe(tenants.a())).isEmpty();
		assertThat(recordatoriosDe(tenants.b())).isEmpty();
	}

	@Test
	void twoRequestsRegisterTwoReminders() {
		Long turnoId = a.turno().getId();

		EnlaceGenerado primero = enA(() -> service.generarEnlace(turnoId));
		clock.advance(Duration.ofMinutes(5));
		EnlaceGenerado segundo = enA(() -> service.generarEnlace(turnoId));

		assertThat(segundo.recordatorioId()).isNotEqualTo(primero.recordatorioId());
		assertThat(segundo.generadoEn()).isEqualTo(AHORA.plusSeconds(300));
		assertThat(recordatoriosDe(tenants.a())).hasSize(2);
	}

	// --- 3.2 auditoria ------------------------------------------------------------------------

	@Test
	void successWritesOneCreateAuditRowWithCanalAndEstadoOnly() throws Exception {
		EnlaceGenerado res = enA(() -> service.generarEnlace(a.turno().getId()));

		List<AuditLog> filas = auditoriaRecordatorios(tenants.a());
		assertThat(filas).hasSize(1);
		AuditLog fila = filas.get(0);
		assertThat(fila.getAccion()).isEqualTo(AccionAuditoria.CREATE);
		assertThat(fila.getEntidadId()).isEqualTo(res.recordatorioId());
		assertThat(JSON.readValue(fila.getDetalle(), new TypeReference<Map<String, Object>>() {
		})).isEqualTo(Map.of("canal", "WHATSAPP_LINK", "estado", "GENERADO"));
		assertThat(fila.getDetalle()).doesNotContain("5491122334455").doesNotContain("Pac")
				.doesNotContain("Apellido");
		assertThat(auditoriaRecordatorios(tenants.b())).isEmpty();
	}

	@Test
	void eachRequestAddsItsOwnAuditRow() {
		Long turnoId = a.turno().getId();

		EnlaceGenerado primero = enA(() -> service.generarEnlace(turnoId));
		EnlaceGenerado segundo = enA(() -> service.generarEnlace(turnoId));

		assertThat(auditoriaRecordatorios(tenants.a())).extracting(AuditLog::getEntidadId)
				.containsExactlyInAnyOrder(primero.recordatorioId(), segundo.recordatorioId());
	}

	@Test
	void rejectionsAddNoAuditRows() {
		Turno cancelado = turno(tenants.a(), a, EstadoTurno.CANCELADO);
		assertThatThrownBy(() -> enA(() -> service.generarEnlace(cancelado.getId())))
				.isInstanceOf(ConflictoException.class);
		assertThatThrownBy(() -> enA(() -> service.generarEnlace(999_999L)))
				.isInstanceOf(RecursoNoEncontradoException.class);
		assertThatThrownBy(() -> enA(() -> service.generarEnlace(b.turno().getId())))
				.isInstanceOf(RecursoNoEncontradoException.class);
		conTelefono(tenants.a(), a, null);
		assertThatThrownBy(() -> enA(() -> service.generarEnlace(a.turno().getId())))
				.isInstanceOf(ReferenciaInvalidaException.class);

		assertThat(auditoriaRecordatorios(tenants.a())).isEmpty();
		assertThat(auditoriaRecordatorios(tenants.b())).isEmpty();
	}

	private List<AuditLog> auditoriaRecordatorios(Long tenant) {
		return fixtures.inTenant(tenant, () -> auditLogs.findAll(Pageable.unpaged()).getContent().stream()
				.filter(l -> "Recordatorio".equals(l.getEntidad())).filter(l -> l.getAccion() == AccionAuditoria.CREATE)
				.toList());
	}

	private Turno turno(Long tenant, Graph g, EstadoTurno estado) {
		return fixtures.inTenant(tenant, () -> {
			Turno t = new Turno(g.paciente(), g.profesional(), g.sillon(), g.prestacion(),
					Instant.parse("2026-12-03T12:00:00Z"), Instant.parse("2026-12-03T12:30:00Z"));
			t.cambiarEstado(estado, estado == EstadoTurno.CANCELADO ? "motivo" : null);
			return turnos.save(t);
		});
	}
}
