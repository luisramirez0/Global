package ar.global.odonto.recordatorio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.agenda.TurnoRepository;
import ar.global.odonto.testsupport.DomainFixtures;
import ar.global.odonto.testsupport.DomainFixtures.Graph;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import java.time.Instant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

@PersistenceTest
class RecordatorioRepositoryTest {

	private static final Instant NOW = Instant.parse("2026-11-23T13:00:00Z");

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private DomainFixtures domain;

	@Autowired
	private RecordatorioRepository recordatorios;

	@Autowired
	private TurnoRepository turnos;

	@Autowired
	private JdbcTemplate jdbc;

	private Tenants tenants;
	private Graph a;
	private Graph b;

	@BeforeEach
	void setUp() {
		fixtures.cleanAll();
		tenants = fixtures.createTenants();
		a = domain.seed(tenants.a(), "a");
		b = domain.seed(tenants.b(), "b");
		jdbc.update("DELETE FROM recordatorio");
	}

	@AfterEach
	void cleanUp() {
		fixtures.cleanAll();
	}

	@Test
	void whatsappLinkReminderIsSavedAsGeneradoWithoutSentDate() {
		Recordatorio saved = fixtures.inTenant(tenants.a(), () -> recordatorios.save(new Recordatorio(
				turnos.getReferenceById(a.turno().getId()), CanalRecordatorio.WHATSAPP_LINK, NOW,
				EstadoRecordatorio.GENERADO)));

		Recordatorio read = fixtures.inTenant(tenants.a(), () -> recordatorios.findById(saved.getId()).orElseThrow());

		assertThat(read.getConsultorioId()).isEqualTo(tenants.a());
		assertThat(read.getCanal()).isEqualTo(CanalRecordatorio.WHATSAPP_LINK);
		assertThat(read.getEstado()).isEqualTo(EstadoRecordatorio.GENERADO);
		assertThat(read.getEnviadoEn()).isNull();
		assertThat(read.getGeneradoEn()).isEqualTo(NOW);
		assertThat(jdbc.queryForObject("SELECT canal FROM recordatorio WHERE id = ?", String.class, saved.getId()))
				.isEqualTo("WHATSAPP_LINK");
	}

	@Test
	void emailReminderCanBeMarkedAsSent() {
		Recordatorio saved = fixtures.inTenant(tenants.a(), () -> recordatorios.save(new Recordatorio(
				turnos.getReferenceById(a.turno().getId()), CanalRecordatorio.EMAIL, NOW, EstadoRecordatorio.GENERADO)));

		saved.setEstado(EstadoRecordatorio.ENVIADO);
		saved.setEnviadoEn(NOW.plusSeconds(60));
		fixtures.inTenant(tenants.a(), () -> recordatorios.save(saved));

		Recordatorio read = fixtures.inTenant(tenants.a(), () -> recordatorios.findById(saved.getId()).orElseThrow());
		assertThat(read.getEstado()).isEqualTo(EstadoRecordatorio.ENVIADO);
		assertThat(read.getEnviadoEn()).isEqualTo(NOW.plusSeconds(60));
	}

	@Test
	void isolationBetweenTenants() {
		Recordatorio ofB = fixtures.inTenant(tenants.b(), () -> recordatorios.save(new Recordatorio(
				turnos.getReferenceById(b.turno().getId()), CanalRecordatorio.EMAIL, NOW, EstadoRecordatorio.GENERADO)));

		fixtures.inTenant(tenants.a(), () -> {
			assertThat(recordatorios.findAll()).isEmpty();
			assertThat(recordatorios.findById(ofB.getId())).isEmpty();
			return null;
		});
	}

	@Test
	void reminderOfAOverTurnoOfBIsRejected() {
		assertThatThrownBy(() -> fixtures.inTenant(tenants.a(), () -> recordatorios.saveAndFlush(new Recordatorio(
				turnos.getReferenceById(b.turno().getId()), CanalRecordatorio.EMAIL, NOW,
				EstadoRecordatorio.GENERADO)))).isInstanceOf(DataIntegrityViolationException.class);
	}
}
