package ar.global.odonto.agenda.horario;

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

/** Horarios de atencion. Lectura: todos los roles; escritura: ADMIN/PROFESIONAL (design D6). */
@RestController
@RequestMapping("/api/horarios-atencion")
public class HorarioController {

	private final HorarioService service;

	public HorarioController(HorarioService service) {
		this.service = service;
	}

	@GetMapping
	@PreAuthorize(Permisos.OPERACION)
	public List<HorarioResponse> listar(@RequestParam(required = false) Long profesionalId) {
		return service.listar(profesionalId);
	}

	@GetMapping("/{id}")
	@PreAuthorize(Permisos.OPERACION)
	public HorarioResponse obtener(@PathVariable Long id) {
		return service.obtener(id);
	}

	@PostMapping
	@PreAuthorize(Permisos.GESTION)
	public ResponseEntity<HorarioResponse> crear(@Valid @RequestBody HorarioRequest request) {
		HorarioResponse creado = service.crear(request);
		return ResponseEntity.created(URI.create("/api/horarios-atencion/" + creado.id())).body(creado);
	}

	@PutMapping("/{id}")
	@PreAuthorize(Permisos.GESTION)
	public HorarioResponse actualizar(@PathVariable Long id, @Valid @RequestBody HorarioRequest request) {
		return service.actualizar(id, request);
	}

	@DeleteMapping("/{id}")
	@PreAuthorize(Permisos.GESTION)
	public ResponseEntity<Void> borrar(@PathVariable Long id) {
		service.borrar(id);
		return ResponseEntity.noContent().build();
	}
}
