package ar.global.odonto.agenda.sillon;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Alta y reemplazo de un sillon. {@code activo} omitido: en alta es true, en edicion no cambia. */
public record SillonRequest(@NotBlank @Size(max = 100) String nombre, Boolean activo) {
}
