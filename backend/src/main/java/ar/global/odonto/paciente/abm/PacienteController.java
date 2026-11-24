package ar.global.odonto.paciente.abm;

import ar.global.odonto.common.web.Pagina;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/**
 * ABM de pacientes (US-020, design D1). Los permisos y el tenant los aplica {@link PacienteService}; aca solo
 * HTTP y DTOs (regla 1). {@code DELETE} es baja logica.
 */
@RestController
@RequestMapping("/api/pacientes")
public class PacienteController {

	private final PacienteService service;

	public PacienteController(PacienteService service) {
		this.service = service;
	}

	@PostMapping
	public ResponseEntity<PacienteResponse> crear(@Valid @RequestBody PacienteRequest request) {
		PacienteResponse creado = service.crear(request);
		URI location = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(creado.id())
				.toUri();
		return ResponseEntity.created(location).body(creado);
	}

	@GetMapping
	public Pagina<PacienteResponse> buscar(@RequestParam(required = false) String q,
			@RequestParam(defaultValue = "false") boolean incluirInactivos,
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "" + PacienteService.TAMANIO_POR_DEFECTO) int size) {
		return service.buscar(q, incluirInactivos, page, size);
	}

	@GetMapping("/{id}")
	public PacienteResponse obtener(@PathVariable Long id) {
		return service.obtener(id);
	}

	@PutMapping("/{id}")
	public PacienteResponse editar(@PathVariable Long id, @Valid @RequestBody PacienteRequest request) {
		return service.editar(id, request);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void darDeBaja(@PathVariable Long id) {
		service.darDeBaja(id);
	}

	@PostMapping("/{id}/reactivar")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void reactivar(@PathVariable Long id) {
		service.reactivar(id);
	}
}
