package ar.global.odonto.recordatorio;

import ar.global.odonto.agenda.EstadoTurno;
import ar.global.odonto.agenda.Profesional;
import ar.global.odonto.agenda.Turno;
import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.common.web.RecursoNoEncontradoException;
import ar.global.odonto.consultorio.Consultorio;
import ar.global.odonto.consultorio.ConsultorioRepository;
import ar.global.odonto.paciente.Paciente;
import ar.global.odonto.paciente.abm.TelefonoE164;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Turnos pendientes de recordatorio de un dia local del consultorio (sin fecha: manana local; C-09, design D7,
 * D10). Lectura pura: no se audita, por eso {@code readOnly = true} es valido (design D6).
 */
@Service
public class RecordatorioPendientesService {

	private static final Set<EstadoTurno> RECORDABLES = Set.of(EstadoTurno.PROGRAMADO, EstadoTurno.CONFIRMADO);

	private final RecordatorioRepository recordatorios;
	private final ConsultorioRepository consultorios;
	private final Clock clock;

	public RecordatorioPendientesService(RecordatorioRepository recordatorios, ConsultorioRepository consultorios,
			Clock clock) {
		this.recordatorios = recordatorios;
		this.consultorios = consultorios;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public List<TurnoPendiente> pendientes(LocalDate fechaPedida) {
		Consultorio consultorio = consultorios.findById(TenantContext.require())
				.orElseThrow(RecursoNoEncontradoException::new);
		ZoneId zona = ZoneId.of(consultorio.getZonaHoraria());
		LocalDate fecha = fechaPedida != null ? fechaPedida
				: Instant.now(clock).atZone(zona).toLocalDate().plusDays(1);
		Instant desde = fecha.atStartOfDay(zona).toInstant();
		Instant hasta = fecha.plusDays(1).atStartOfDay(zona).toInstant();
		List<Turno> turnos = recordatorios.buscarPendientes(RECORDABLES, desde, hasta);
		Map<Long, Recordatorio> ultimos = ultimosPorTurno(turnos);
		return turnos.stream().map(t -> vista(t, ultimos.get(t.getId()))).toList();
	}

	/** Ultimo recordatorio por turno: la consulta ya viene del mas reciente al mas antiguo (design D10). */
	private Map<Long, Recordatorio> ultimosPorTurno(List<Turno> turnos) {
		Map<Long, Recordatorio> ultimos = new HashMap<>();
		if (turnos.isEmpty()) {
			return ultimos;
		}
		recordatorios.buscarPorTurnos(turnos.stream().map(Turno::getId).toList())
				.forEach(r -> ultimos.putIfAbsent(r.getTurno().getId(), r));
		return ultimos;
	}

	private static TurnoPendiente vista(Turno t, Recordatorio ultimo) {
		Paciente paciente = t.getPaciente();
		Profesional profesional = t.getProfesional();
		return new TurnoPendiente(t.getId(), t.getInicio(), t.getFin(), t.getEstado(),
				new TurnoPendiente.Persona(paciente.getId(), paciente.getNombre(), paciente.getApellido()),
				new TurnoPendiente.Persona(profesional.getId(), profesional.getNombre(), profesional.getApellido()),
				TelefonoE164.esValido(paciente.getTelefono()), tieneTexto(paciente.getEmail()),
				ultimo == null ? null
						: new TurnoPendiente.UltimoRecordatorio(ultimo.getCanal(), ultimo.getEstado(),
								ultimo.getGeneradoEn()));
	}

	private static boolean tieneTexto(String valor) {
		return valor != null && !valor.isBlank();
	}
}
