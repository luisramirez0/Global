package ar.global.odonto.recordatorio;

import ar.global.odonto.agenda.EstadoTurno;
import ar.global.odonto.agenda.Turno;
import ar.global.odonto.agenda.TurnoRepository;
import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.auditoria.AuditService;
import ar.global.odonto.auditoria.AuditoriaFallidaException;
import ar.global.odonto.auditoria.DetalleAuditoria;
import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.common.web.ConflictoException;
import ar.global.odonto.common.web.RecursoNoEncontradoException;
import ar.global.odonto.common.web.ReferenciaInvalidaException;
import ar.global.odonto.consultorio.Consultorio;
import ar.global.odonto.consultorio.ConsultorioRepository;
import ar.global.odonto.paciente.abm.TelefonoE164;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Recordatorio por WhatsApp (C-09, design D2, D4, D6). Orden de validacion: turno (404 si no existe o es de otro
 * consultorio) → estado (409 salvo {@code PROGRAMADO}/{@code CONFIRMADO}) → telefono (422 {@code telefono}, tambien si
 * el guardado no es E.164 valido). Registra un {@code GENERADO} por pedido y lo audita en la misma transaccion
 * (fail-closed). Es de lectura-escritura (NO {@code readOnly}, regla 5 de C-06) y no usa {@code @Audited}: el
 * detalle depende del resultado. Los rechazos no dejan recordatorio ni fila de auditoria.
 */
@Service
public class RecordatorioWhatsAppService {

	static final String ENTIDAD_AUDITADA = "Recordatorio";
	static final String TITULO_ESTADO = "El turno no admite recordatorio en su estado actual";

	private static final Logger log = LoggerFactory.getLogger(RecordatorioWhatsAppService.class);

	private final TurnoRepository turnos;
	private final RecordatorioRepository recordatorios;
	private final ConsultorioRepository consultorios;
	private final AuditService auditoria;
	private final Clock clock;

	public RecordatorioWhatsAppService(TurnoRepository turnos, RecordatorioRepository recordatorios,
			ConsultorioRepository consultorios, AuditService auditoria, Clock clock) {
		this.turnos = turnos;
		this.recordatorios = recordatorios;
		this.consultorios = consultorios;
		this.auditoria = auditoria;
		this.clock = clock;
	}

	@Transactional
	public EnlaceGenerado generarEnlace(Long turnoId) {
		Turno turno = turnos.findById(turnoId).orElseThrow(RecursoNoEncontradoException::new);
		if (turno.getEstado() != EstadoTurno.PROGRAMADO && turno.getEstado() != EstadoTurno.CONFIRMADO) {
			throw new ConflictoException(TITULO_ESTADO);
		}
		String telefono = turno.getPaciente().getTelefono();
		if (!TelefonoE164.esValido(telefono)) {
			throw new ReferenciaInvalidaException("telefono");
		}
		Consultorio consultorio = consultorios.findById(TenantContext.require())
				.orElseThrow(RecursoNoEncontradoException::new);
		String texto = MensajeRecordatorio.de(turno.getInicio(), ZoneId.of(consultorio.getZonaHoraria()),
				consultorio.getNombre(),
				turno.getProfesional().getNombre() + " " + turno.getProfesional().getApellido());
		String enlace = EnlaceWhatsApp.para(telefono, texto);

		Instant ahora = Instant.now(clock);
		Recordatorio guardado = recordatorios.saveAndFlush(Recordatorio.generado(turno, ahora));
		auditar(guardado);
		// Solo ids (regla 5): ni telefono, ni enlace, ni texto del mensaje.
		log.info("Recordatorio generado canal={} recordatorioId={} turnoId={}", CanalRecordatorio.WHATSAPP_LINK,
				guardado.getId(), turno.getId());
		return new EnlaceGenerado(guardado.getId(), enlace, ahora);
	}

	/** Fail-closed: si la auditoria falla se revierte el recordatorio; el log lleva solo ids y el tipo de error. */
	private void auditar(Recordatorio recordatorio) {
		try {
			auditoria.registrar(AccionAuditoria.CREATE, ENTIDAD_AUDITADA, recordatorio.getId(),
					DetalleAuditoria.vacio().con("canal", CanalRecordatorio.WHATSAPP_LINK).con("estado",
							EstadoRecordatorio.GENERADO));
		}
		catch (RuntimeException e) {
			log.error("Fallo de auditoria accion={} entidad={} entidadId={} consultorioId={} causa={}",
					AccionAuditoria.CREATE, ENTIDAD_AUDITADA, recordatorio.getId(),
					TenantContext.get().orElse(null), e.getClass().getSimpleName());
			throw new AuditoriaFallidaException();
		}
	}
}
