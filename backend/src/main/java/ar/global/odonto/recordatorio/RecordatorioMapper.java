package ar.global.odonto.recordatorio;

/** Resultado de servicio → DTO (regla 1: los controladores no ven entidades JPA). */
public final class RecordatorioMapper {

	private RecordatorioMapper() {
	}

	public static EnlaceWhatsAppResponse toResponse(EnlaceGenerado generado) {
		return new EnlaceWhatsAppResponse(generado.recordatorioId(), generado.enlace(), generado.generadoEn());
	}

	public static RecordatorioEmailResponse toResponse(EmailEnviado enviado) {
		return new RecordatorioEmailResponse(enviado.recordatorioId(), enviado.estado(), enviado.enviadoEn());
	}

	public static TurnoPendienteResponse toResponse(TurnoPendiente pendiente) {
		return new TurnoPendienteResponse(pendiente.turnoId(), pendiente.inicio(), pendiente.fin(),
				pendiente.estado(), persona(pendiente.paciente()), persona(pendiente.profesional()), pendiente.tieneTelefono(), pendiente.tieneEmail(), ultimo(pendiente.ultimoRecordatorio()));
	}

	private static TurnoPendienteResponse.UltimoRecordatorioResponse ultimo(TurnoPendiente.UltimoRecordatorio u) {
		return u == null ? null
				: new TurnoPendienteResponse.UltimoRecordatorioResponse(u.canal(), u.estado(), u.generadoEn());
	}

	private static TurnoPendienteResponse.PersonaResponse persona(TurnoPendiente.Persona p) {
		return new TurnoPendienteResponse.PersonaResponse(p.id(), p.nombre(), p.apellido());
	}
}
