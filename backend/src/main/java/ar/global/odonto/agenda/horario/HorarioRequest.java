package ar.global.odonto.agenda.horario;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.LocalTime;

/** Franja semanal; horas locales del consultorio {@code HH:mm}. {@code profesionalId} omitido: ver design D8. */
public record HorarioRequest(Long profesionalId, @NotNull @Min(1) @Max(7) Integer diaSemana,
		@NotNull @JsonFormat(pattern = "HH:mm") LocalTime horaDesde,
		@NotNull @JsonFormat(pattern = "HH:mm") LocalTime horaHasta) {
}
