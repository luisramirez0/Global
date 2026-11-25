package ar.global.odonto.recordatorio;

import java.time.Instant;

/** Respuesta del enlace de WhatsApp (design D12). El enlace lleva el telefono; es la unica salida que lo contiene. */
public record EnlaceWhatsAppResponse(Long recordatorioId, String enlace, Instant generadoEn) {

	@Override
	public String toString() {
		return "EnlaceWhatsAppResponse[recordatorioId=" + recordatorioId + ", enlace=<oculto>]";
	}
}
