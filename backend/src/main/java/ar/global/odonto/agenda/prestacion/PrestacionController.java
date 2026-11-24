package ar.global.odonto.agenda.prestacion;

import ar.global.odonto.security.Permisos;
import jakarta.validation.Valid;
import java.net.URI;
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

/** Prestaciones. Lectura: todos los roles; escritura: ADMIN/PROFESIONAL (design D6). */
@RestController
@RequestMapping("/api/prestaciones")
public class PrestacionController {

	private final PrestacionService service;

	public PrestacionController(PrestacionService service) {
		this.service = service;
	}

	@GetMapping
	@PreAuthorize(Permisos.OPERACION)
	public List<PrestacionResponse> listar(@RequestParam(defaultValue = "false") boolean incluirInactivas) {
		return service.listar(incluirInactivas);
	}

	@GetMapping("/{id}")
	@PreAuthorize(Permisos.OPERACION)
	public PrestacionResponse obtener(@PathVariable Long id) {
		return service.obtener(id);
	}

	@PostMapping
	@PreAuthorize(Permisos.GESTION)
	public ResponseEntity<PrestacionResponse> crear(@Valid @RequestBody PrestacionRequest request) {
		PrestacionResponse creada = service.crear(request);
		return ResponseEntity.created(URI.create("/api/prestaciones/" + creada.id())).body(creada);
	}

	@PutMapping("/{id}")
	@PreAuthorize(Permisos.GESTION)
	public PrestacionResponse actualizar(@PathVariable Long id, @Valid @RequestBody PrestacionRequest request) {
		return service.actualizar(id, request);
	}

	@DeleteMapping("/{id}")
	@PreAuthorize(Permisos.GESTION)
	public ResponseEntity<Void> darDeBaja(@PathVariable Long id) {
		service.darDeBaja(id);
		return ResponseEntity.noContent().build();
	}
}
