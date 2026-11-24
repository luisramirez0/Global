package ar.global.odonto.paciente.ficha;

import ar.global.odonto.common.web.Pagina;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Notas clinicas (design D2, D7). Solo alta y listado: no hay PUT ni DELETE, las notas son inmutables. Permisos,
 * consentimiento y auditoria en {@link NotaService}.
 */
@RestController
@RequestMapping("/api/pacientes/{pacienteId}/notas")
public class NotaController {

	private final NotaService service;

	public NotaController(NotaService service) {
		this.service = service;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public NotaResponse crear(@PathVariable Long pacienteId, @Valid @RequestBody NotaRequest request) {
		return service.crear(pacienteId, request);
	}

	@GetMapping
	public Pagina<NotaResponse> listar(@PathVariable Long pacienteId, @RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "" + NotaService.TAMANIO_POR_DEFECTO) int size) {
		return service.listar(pacienteId, page, size);
	}
}
