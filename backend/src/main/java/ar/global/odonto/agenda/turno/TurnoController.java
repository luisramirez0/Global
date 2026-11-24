package ar.global.odonto.agenda.turno;

import ar.global.odonto.security.Permisos;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Turnos (C-07). Operacion de los tres roles ({@code OPERACION}, KB 03 "Turnos: CRUD"), sobreturno incluido
 * (design D3). Sin borrado: un turno se cancela (RN-AG-07).
 */
@RestController
@RequestMapping("/api/turnos")
public class TurnoController {

	private final TurnoService service;

	public TurnoController(TurnoService service) {
		this.service = service;
	}

	/** Agenda por rango {@code [desde, hasta)} de hasta 42 dias (design D10). */
	@GetMapping
	@PreAuthorize(Permisos.OPERACION)
	public List<TurnoResponse> listar(@RequestParam Instant desde, @RequestParam Instant hasta,
			@RequestParam(required = false) Long sillonId, @RequestParam(required = false) Long profesionalId,
			@RequestParam(defaultValue = "false") boolean incluirCancelados) {
		return service.listar(desde, hasta, sillonId, profesionalId, incluirCancelados);
	}

	@GetMapping("/{id}")
	@PreAuthorize(Permisos.OPERACION)
	public TurnoResponse obtener(@PathVariable Long id) {
		return service.obtener(id);
	}

	@PostMapping
	@PreAuthorize(Permisos.OPERACION)
	public ResponseEntity<TurnoResponse> crear(@Valid @RequestBody TurnoCreateRequest request) {
		TurnoResponse creado = service.crear(request);
		return ResponseEntity.created(URI.create("/api/turnos/" + creado.id())).body(creado);
	}

	@PatchMapping("/{id}/estado")
	@PreAuthorize(Permisos.OPERACION)
	public TurnoResponse cambiarEstado(@PathVariable Long id, @Valid @RequestBody TurnoEstadoRequest request) {
		return service.cambiarEstado(id, request);
	}

	/** Reprogramar (RN-AG-06): mueve inicio, sillon y/o profesional conservando la duracion. */
	@PutMapping("/{id}")
	@PreAuthorize(Permisos.OPERACION)
	public TurnoResponse reprogramar(@PathVariable Long id, @Valid @RequestBody TurnoReprogramarRequest request) {
		return service.reprogramar(id, request);
	}
}
