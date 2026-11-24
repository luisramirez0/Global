package ar.global.odonto.agenda.sillon;

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

/** Sillones del consultorio. Lectura: todos los roles; escritura: ADMIN/PROFESIONAL (design D6). */
@RestController
@RequestMapping("/api/sillones")
public class SillonController {

	private final SillonService service;

	public SillonController(SillonService service) {
		this.service = service;
	}

	@GetMapping
	@PreAuthorize(Permisos.OPERACION)
	public List<SillonResponse> listar(@RequestParam(defaultValue = "false") boolean incluirInactivos) {
		return service.listar(incluirInactivos);
	}

	@GetMapping("/{id}")
	@PreAuthorize(Permisos.OPERACION)
	public SillonResponse obtener(@PathVariable Long id) {
		return service.obtener(id);
	}

	@PostMapping
	@PreAuthorize(Permisos.GESTION)
	public ResponseEntity<SillonResponse> crear(@Valid @RequestBody SillonRequest request) {
		SillonResponse creado = service.crear(request);
		return ResponseEntity.created(URI.create("/api/sillones/" + creado.id())).body(creado);
	}

	@PutMapping("/{id}")
	@PreAuthorize(Permisos.GESTION)
	public SillonResponse actualizar(@PathVariable Long id, @Valid @RequestBody SillonRequest request) {
		return service.actualizar(id, request);
	}

	@DeleteMapping("/{id}")
	@PreAuthorize(Permisos.GESTION)
	public ResponseEntity<Void> darDeBaja(@PathVariable Long id) {
		service.darDeBaja(id);
		return ResponseEntity.noContent().build();
	}
}
