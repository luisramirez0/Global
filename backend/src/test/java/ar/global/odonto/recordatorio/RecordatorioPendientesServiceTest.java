package ar.global.odonto.recordatorio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.consultorio.Consultorio;
import ar.global.odonto.consultorio.ConsultorioRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Guard de {@link RecordatorioPendientesService} (C-09 tarea 4.1): sin turnos pendientes no hay segunda consulta. */
class RecordatorioPendientesServiceTest {

	private final RecordatorioRepository recordatorios = mock(RecordatorioRepository.class);
	private final ConsultorioRepository consultorios = mock(ConsultorioRepository.class);
	private RecordatorioPendientesService service;

	@BeforeEach
	void setUp() {
		Consultorio consultorio = new Consultorio("Consultorio");
		consultorio.setZonaHoraria("America/Argentina/Buenos_Aires");
		when(consultorios.findById(1L)).thenReturn(Optional.of(consultorio));
		when(recordatorios.buscarPendientes(any(), any(), any())).thenReturn(List.of());
		TenantContext.set(1L);
		service = new RecordatorioPendientesService(recordatorios, consultorios,
				Clock.fixed(Instant.parse("2026-11-25T14:00:00Z"), ZoneOffset.UTC));
	}

	@AfterEach
	void tearDown() {
		TenantContext.clear();
	}

	@Test
	void noTurnosMeansNoReminderLookupAndEmptyResult() {
		assertThat(service.pendientes(LocalDate.parse("2026-11-26"))).isEmpty();

		verify(recordatorios, never()).buscarPorTurnos(any());
	}
}
