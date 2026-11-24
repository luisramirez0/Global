package ar.global.odonto.paciente.ficha;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Ficha clinica del paciente (design D5, D6). Permisos, consentimiento y auditoria en {@link FichaService}. */
@RestController
@RequestMapping("/api/pacientes/{pacienteId}/ficha")
public class FichaController {

	private final FichaService service;

	public FichaController(FichaService service) {
		this.service = service;
	}

	@GetMapping
	public FichaResponse obtener(@PathVariable Long pacienteId) {
		return service.obtener(pacienteId);
	}

	@PutMapping
	public FichaResponse guardar(@PathVariable Long pacienteId, @Valid @RequestBody FichaRequest request) {
		return service.guardar(pacienteId, request);
	}
}
