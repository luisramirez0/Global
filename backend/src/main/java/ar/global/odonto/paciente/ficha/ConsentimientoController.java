package ar.global.odonto.paciente.ficha;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Consentimientos y texto vigente (design D10). Permisos y auditoria en {@link ConsentimientoService}. */
@RestController
public class ConsentimientoController {

	private final ConsentimientoService service;

	public ConsentimientoController(ConsentimientoService service) {
		this.service = service;
	}

	@PostMapping("/api/pacientes/{pacienteId}/consentimientos")
	@ResponseStatus(HttpStatus.CREATED)
	public ConsentimientoResponse registrar(@PathVariable Long pacienteId,
			@Valid @RequestBody ConsentimientoRequest request) {
		return service.registrar(pacienteId, request);
	}

	@GetMapping("/api/pacientes/{pacienteId}/consentimientos")
	public List<ConsentimientoResponse> listar(@PathVariable Long pacienteId) {
		return service.listar(pacienteId);
	}

	@GetMapping("/api/consentimientos/texto-vigente")
	public TextoConsentimientoResponse textoVigente() {
		return service.textoVigente();
	}
}
