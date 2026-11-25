package ar.global.odonto.recordatorio;

import ar.global.odonto.security.Permisos;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Recordatorios de turnos (C-09). Operacion de los tres roles ({@code OPERACION}, KB 03). Rutas bajo
 * {@code /api/turnos} pero en un controlador propio: {@code TurnoController} (C-07) no se toca (design D1).
 */
@RestController
public class RecordatorioController {

	private final RecordatorioWhatsAppService whatsApp;

	private final RecordatorioPendientesService pendientes;

	private final RecordatorioEmailService email;

	public RecordatorioController(RecordatorioWhatsAppService whatsApp, RecordatorioPendientesService pendientes,
			RecordatorioEmailService email) {
		this.whatsApp = whatsApp;
		this.pendientes = pendientes;
		this.email = email;
	}

	/**
	 * Genera el enlace {@code wa.me} con el mensaje del recordatorio.
	 *
	 * <p>
	 * <b>Efecto lateral:</b> aunque es un {@code GET}, NO es idempotente ni seguro: cada pedido registra un
	 * {@code Recordatorio} {@code WHATSAPP_LINK}/{@code GENERADO} nuevo y una fila de auditoria (el sistema no puede
	 * saber si la persona llego a enviarlo, RN-CO-01). Se mantiene como {@code GET} por contrato de KB (Flujo 3) y
	 * CHANGES.md. Los clientes deben pedirlo solo ante un clic explicito, nunca al renderizar ni en prefetch.
	 */
	@GetMapping("/api/turnos/{id}/recordatorio/whatsapp")
	@PreAuthorize(Permisos.OPERACION)
	public EnlaceWhatsAppResponse enlaceWhatsApp(@PathVariable Long id) {
		return RecordatorioMapper.toResponse(whatsApp.generarEnlace(id));
	}

	/**
	 * Envia por SMTP el recordatorio al email del paciente. {@code 201} si el servidor acepta el envio; {@code 502}
	 * si falla el envio o la comunicacion con el SMTP; {@code 503} si el SMTP no esta configurado.
	 */
	@PostMapping("/api/turnos/{id}/recordatorio/email")
	@PreAuthorize(Permisos.OPERACION)
	@ResponseStatus(HttpStatus.CREATED)
	public RecordatorioEmailResponse enviarEmail(@PathVariable Long id) {
		return RecordatorioMapper.toResponse(email.enviar(id));
	}

	/**
	 * Turnos recordables de un dia local del consultorio que aun no tienen recordatorio generado ni enviado. Sin
	 * {@code fecha}: manana en la zona del consultorio.
	 */
	@GetMapping("/api/turnos/pendientes-recordatorio")
	@PreAuthorize(Permisos.OPERACION)
	public List<TurnoPendienteResponse> pendientes(@RequestParam(required = false) LocalDate fecha) {
		return pendientes.pendientes(fecha).stream().map(RecordatorioMapper::toResponse).toList();
	}
}
