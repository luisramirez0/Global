package ar.global.odonto.recordatorio;

import java.time.Instant;

/** Resultado del servicio de WhatsApp: el recordatorio registrado y su enlace {@code wa.me}. */
public record EnlaceGenerado(Long recordatorioId, String enlace, Instant generadoEn) {
}
