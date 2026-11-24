package ar.global.odonto.paciente.ficha;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Alta de consentimiento: solo la version del texto aceptado; fecha y usuario los pone el servidor (D10). */
public record ConsentimientoRequest(@NotBlank @Size(max = 20) String versionTexto) {
}
