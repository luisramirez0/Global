package ar.global.odonto.recordatorio;

import java.time.Instant;

/** Respuesta del recordatorio por email (design D12). No incluye email, mensaje ni datos del paciente. */
public record RecordatorioEmailResponse(Long recordatorioId, EstadoRecordatorio estado, Instant enviadoEn) {
}
