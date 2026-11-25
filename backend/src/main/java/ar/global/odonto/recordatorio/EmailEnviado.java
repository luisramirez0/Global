package ar.global.odonto.recordatorio;

import java.time.Instant;

/** Resultado del servicio de email: el recordatorio registrado y cuando salio. */
public record EmailEnviado(Long recordatorioId, EstadoRecordatorio estado, Instant enviadoEn) {
}
