package ar.global.odonto.agenda.turno;

import ar.global.odonto.agenda.Turno;
import ar.global.odonto.agenda.TurnoRepository;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Busca el primer turno con el que choca un intervalo (RN-AG-01/02, design D2/D9): primero por sillon (siempre),
 * despues por profesional (salvo sobreturno). Se llama con el lock del consultorio ya tomado (design D1). Es un
 * bean aparte a proposito: el test de concurrencia lo decora para detener un hilo despues de validar.
 */
@Component
public class DetectorConflictos {

	/** Turno en conflicto y el motivo. */
	public record Conflicto(Turno turno, MotivoConflicto motivo) {
	}

	private final TurnoRepository turnos;

	public DetectorConflictos(TurnoRepository turnos) {
		this.turnos = turnos;
	}

	/** {@code excluirId}: el propio turno al reprogramar (nulo en el alta). */
	public Optional<Conflicto> primerConflicto(IntervaloTurno intervalo, long sillonId, long profesionalId,
			ExcepcionesSobreturno excepciones, Long excluirId) {
		Optional<Conflicto> sillon = turnos
				.primerConflictoSillon(sillonId, intervalo.inicio(), intervalo.fin(), excluirId)
				.map(t -> new Conflicto(t, MotivoConflicto.SILLON));
		if (sillon.isPresent() || !excepciones.verificaProfesional()) {
			return sillon;
		}
		return turnos.primerConflictoProfesional(profesionalId, intervalo.inicio(), intervalo.fin(), excluirId)
				.map(t -> new Conflicto(t, MotivoConflicto.PROFESIONAL));
	}
}
