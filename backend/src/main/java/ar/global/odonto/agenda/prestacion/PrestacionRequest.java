package ar.global.odonto.agenda.prestacion;

import ar.global.odonto.agenda.config.DuracionEnGrilla;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/** Alta y reemplazo de una prestacion. {@code activo} omitido: en alta es true, en edicion no cambia. */
public record PrestacionRequest(@NotBlank @Size(max = 150) String nombre,
		@NotNull @Positive @DuracionEnGrilla Integer duracionMinutos, Boolean activo) {
}
