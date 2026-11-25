package ar.global.odonto.recordatorio;

import ar.global.odonto.agenda.EstadoTurno;
import ar.global.odonto.agenda.Turno;
import ar.global.odonto.agenda.TurnoRepository;
import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.auditoria.AuditService;
import ar.global.odonto.auditoria.DetalleAuditoria;
import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.common.web.ConflictoException;
import ar.global.odonto.common.web.RecursoNoEncontradoException;
import ar.global.odonto.common.web.ReferenciaInvalidaException;
import ar.global.odonto.consultorio.Consultorio;
import ar.global.odonto.consultorio.ConsultorioRepository;
import ar.global.odonto.recordatorio.email.EnvioEmail;
import ar.global.odonto.recordatorio.email.EnvioEmailException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.function.Function;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Recordatorio por email en tres pasos, SIN {@code @Transactional} de metodo (C-09, design D5, D6, D13): (a)
 * lectura (404 → 409 → 422 {@code email}, sin auditoria), (b) envio SMTP fuera de toda transaccion, (c) escritura
 * de {@code ENVIADO} o {@code ERROR} + auditoria fail-closed. Si el turno cambia entre (a) y (c) igual se registra
 * lo ocurrido: el email ya salio. Ante una falla del puerto se registra {@code ERROR} con el codigo fijo y se
 * relanza la excepcion (502/503).
 */
@Service
public class RecordatorioEmailService {

	static final String ASUNTO = "Recordatorio de turno";

	private static final Logger log = LoggerFactory.getLogger(RecordatorioEmailService.class);

	private final TurnoRepository turnos;
	private final RecordatorioRepository recordatorios;
	private final ConsultorioRepository consultorios;
	private final AuditService auditoria;
	private final EnvioEmail envio;
	private final TransactionTemplate lectura;
	private final TransactionTemplate escritura;
	private final Clock clock;

	public RecordatorioEmailService(TurnoRepository turnos, RecordatorioRepository recordatorios,
			ConsultorioRepository consultorios, AuditService auditoria, EnvioEmail envio,
			PlatformTransactionManager transactionManager, Clock clock) {
		this.turnos = turnos;
		this.recordatorios = recordatorios;
		this.consultorios = consultorios;
		this.auditoria = auditoria;
		this.envio = envio;
		this.clock = clock;
		this.lectura = new TransactionTemplate(transactionManager);
		this.lectura.setReadOnly(true);
		// Explicito (patron C-15): lectura-escritura y REQUIRED, para que el INSERT no falle en MySQL por una
		// conexion de solo lectura.
		this.escritura = new TransactionTemplate(transactionManager);
		this.escritura.setReadOnly(false);
		this.escritura.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);
	}

	/** Lo que el paso (a) captura para salir de la transaccion de lectura: ids y texto, ninguna entidad. */
	private record Preparado(Long turnoId, String destinatario, String texto) {
	}

	/** Sin {@code @Transactional} de metodo: el envio SMTP corre fuera de toda transaccion (design D5). */
	public EmailEnviado enviar(Long turnoId) {
		Preparado preparado = lectura.execute(s -> preparar(turnoId));
		Instant generadoEn = Instant.now(clock);
		try {
			envio.enviar(preparado.destinatario(), ASUNTO, preparado.texto());
		}
		catch (EnvioEmailException e) {
			// 502 (EnvioEmailFallidoException) o 503 (EmailNoConfiguradoException): se registra ERROR y se relanza.
			Recordatorio conError = persistir(preparado.turnoId(),
					turno -> Recordatorio.error(turno, generadoEn, e.getCodigo()));
			// Solo ids y el codigo fijo (design D9): nunca el email, el mensaje ni la excepcion completa.
			log.warn("Recordatorio email con error recordatorioId={} turnoId={} codigo={}", conError.getId(),
					preparado.turnoId(), e.getCodigo());
			throw e;
		}
		Instant enviadoEn = Instant.now(clock);
		Recordatorio guardado = persistir(preparado.turnoId(),
				turno -> Recordatorio.enviado(turno, generadoEn, enviadoEn));
		log.info("Recordatorio email enviado recordatorioId={} turnoId={}", guardado.getId(), preparado.turnoId());
		return new EmailEnviado(guardado.getId(), guardado.getEstado(), enviadoEn);
	}

	/**
	 * Paso (c): recordatorio + auditoria en una misma transaccion de escritura (fail-closed). Si algo falla (turno
	 * desaparecido, auditoria, BD) el email ya salio: se loguea solo {@code turnoId} y el nombre simple de la
	 * excepcion (sin PII, design D9/D13) y se relanza, lo que termina en el {@code 500} generico.
	 */
	private Recordatorio persistir(Long turnoId, Function<Turno, Recordatorio> factory) {
		try {
			return escritura.execute(s -> {
				// findById + excepcion explicita (no getReferenceById): un turno desaparecido es un error claro y no
				// una violacion de FK al hacer flush.
				Turno turno = turnos.findById(turnoId).orElseThrow(
						() -> new IllegalStateException("El turno desaparecio antes de registrar el recordatorio"));
				Recordatorio guardado = recordatorios.saveAndFlush(factory.apply(turno));
				auditoria.registrar(AccionAuditoria.CREATE, "Recordatorio", guardado.getId(),
						DetalleAuditoria.vacio().con("canal", guardado.getCanal()).con("estado", guardado.getEstado()));
				return guardado;
			});
		}
		catch (RuntimeException e) {
			log.error("No se pudo registrar el recordatorio de email turnoId={} causa={}", turnoId,
					e.getClass().getSimpleName());
			throw e;
		}
	}

	private Preparado preparar(Long turnoId) {
		Turno turno = turnos.findById(turnoId).orElseThrow(RecursoNoEncontradoException::new);
		if (turno.getEstado() != EstadoTurno.PROGRAMADO && turno.getEstado() != EstadoTurno.CONFIRMADO) {
			throw new ConflictoException(RecordatorioWhatsAppService.TITULO_ESTADO);
		}
		String email = turno.getPaciente().getEmail();
		if (email == null || email.isBlank()) {
			throw new ReferenciaInvalidaException("email");
		}
		Consultorio consultorio = consultorios.findById(TenantContext.require())
				.orElseThrow(RecursoNoEncontradoException::new);
		String texto = MensajeRecordatorio.de(turno.getInicio(), ZoneId.of(consultorio.getZonaHoraria()),
				consultorio.getNombre(), turno.getProfesional().getNombre() + " " + turno.getProfesional().getApellido());
		return new Preparado(turno.getId(), email, texto);
	}
}
