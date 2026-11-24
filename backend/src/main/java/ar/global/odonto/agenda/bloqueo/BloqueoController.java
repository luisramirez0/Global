package ar.global.odonto.agenda.bloqueo;

import ar.global.odonto.security.Permisos;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Bloqueos de agenda. Leer/crear/editar: todos los roles; borrar: ADMIN/PROFESIONAL (design D6; KB 03 y
 * spec access-control mandan sobre la redaccion de CHANGES.md).
 */
@RestController
@RequestMapping("/api/bloqueos")
public class BloqueoController {

	private final BloqueoService service;

	public BloqueoController(BloqueoService service) {
		this.service = service;
	}

	@GetMapping
	@PreAuthorize(Permisos.OPERACION)
	public List<BloqueoResponse> listar(@RequestParam(required = false) Instant desde,
			@RequestParam(required = false) Instant hasta, @RequestParam(required = false) Long sillonId,
			@RequestParam(required = false) Long profesionalId) {
		return service.listar(desde, hasta, sillonId, profesionalId);
	}

	@GetMapping("/{id}")
	@PreAuthorize(Permisos.OPERACION)
	public BloqueoResponse obtener(@PathVariable Long id) {
		return service.obtener(id);
	}

	@PostMapping
	@PreAuthorize(Permisos.OPERACION)
	public ResponseEntity<BloqueoResponse> crear(@Valid @RequestBody BloqueoRequest request) {
		BloqueoResponse creado = service.crear(request);
		return ResponseEntity.created(URI.create("/api/bloqueos/" + creado.id())).body(creado);
	}

	@PutMapping("/{id}")
	@PreAuthorize(Permisos.OPERACION)
	public BloqueoResponse actualizar(@PathVariable Long id, @Valid @RequestBody BloqueoRequest request) {
		return service.actualizar(id, request);
	}

	@DeleteMapping("/{id}")
	@PreAuthorize(Permisos.GESTION)
	public ResponseEntity<Void> borrar(@PathVariable Long id) {
		service.borrar(id);
		return ResponseEntity.noContent().build();
	}
}
