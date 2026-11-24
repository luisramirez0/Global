package ar.global.odonto.auditoria.consulta;

import ar.global.odonto.auditoria.AuditedProbeService;
import java.util.Map;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Controller SOLO de tests: devuelve un dato clinico ficticio desde un metodo {@code @Audited} READ. */
@TestComponent
@RestController
@RequestMapping("/api/test/auditado")
public class AuditProbeController {

	private final AuditedProbeService servicio;

	public AuditProbeController(AuditedProbeService servicio) {
		this.servicio = servicio;
	}

	@GetMapping
	public Map<String, String> clinico() {
		return Map.of("dato", servicio.datoClinicoFicticio(1L));
	}
}
