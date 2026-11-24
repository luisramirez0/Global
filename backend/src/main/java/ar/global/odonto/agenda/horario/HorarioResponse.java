package ar.global.odonto.agenda.horario;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalTime;

public record HorarioResponse(Long id, Long profesionalId, int diaSemana,
		@JsonFormat(pattern = "HH:mm") LocalTime horaDesde, @JsonFormat(pattern = "HH:mm") LocalTime horaHasta) {
}
