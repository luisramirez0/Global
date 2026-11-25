package ar.global.odonto.paciente.export;

import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code GET /api/pacientes/{id}/export} (design D1). Permisos, tenant y auditoria en
 * {@link PacienteExportService}; aca solo HTTP. El nombre del archivo lleva solo el id (nunca nombre ni DNI).
 */
@RestController
public class PacienteExportController {

	private final PacienteExportService service;

	public PacienteExportController(PacienteExportService service) {
		this.service = service;
	}

	@GetMapping(value = "/api/pacientes/{pacienteId}/export", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<PacienteExportResponse> exportar(@PathVariable Long pacienteId) {
		PacienteExportResponse paquete = service.exportar(pacienteId);
		String archivo = "paciente-" + pacienteId + "-export.json";
		return ResponseEntity.ok()
				.header(HttpHeaders.CONTENT_DISPOSITION,
						ContentDisposition.attachment().filename(archivo).build().toString())
				.cacheControl(CacheControl.noStore()).contentType(MediaType.APPLICATION_JSON).body(paquete);
	}
}
