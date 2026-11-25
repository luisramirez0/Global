package ar.global.odonto.paciente.export;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletResponse;

import com.fasterxml.jackson.databind.JsonNode;

import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.auditoria.AuditLog;
import ar.global.odonto.auditoria.AuditLogRepository;
import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TestClockConfig;
import ar.global.odonto.testsupport.TestTokens;
import ar.global.odonto.usuario.Rol;

/**
 * Lectura del export y de los accesos de un paciente con {@code GET /api/auditoria} (C-15 tarea 3.4, design D8):
 * caracteriza que {@code entidadId} no distingue entidades (spec audit-log, escenario "Id de entidad compartido
 * entre entidades") sin cambiar el backend de C-06.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, TestTokens.class, ApiCalls.class, ExportFixtures.class,
		TestClockConfig.class })
class PacienteExportAuditoriaIT {

	private static final long ID_COMPARTIDO = 424_242L;

	@Autowired
	private ApiCalls api;

	@Autowired
	private AuthFlows auth;

	@Autowired
	private TestTokens tokens;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private ExportFixtures export;

	@Autowired
	private AuditLogRepository auditLogs;

	private AuthFlows.Cuenta cuenta;

	private String admin;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		cuenta = auth.registrar("export-aud@consultorio.test");
		admin = tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), Rol.ADMIN);
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	private List<String> entidades(MockHttpServletResponse r) throws Exception {
		assertThat(r.getStatus()).as(r.getContentAsString()).isEqualTo(200);
		List<String> lista = new ArrayList<>();
		for (JsonNode n : api.json(r).get("contenido")) {
			lista.add(n.get("accion").asText() + " " + n.get("entidad").asText() + " " + n.get("entidadId").asLong());
		}
		return lista;
	}

	private void sembrarIdCompartido() {
		fixtures.inTenant(cuenta.consultorioId(), () -> {
			auditLogs.save(new AuditLog(cuenta.usuarioId(), AccionAuditoria.READ, "FichaClinica", ID_COMPARTIDO,
					null, null));
			return auditLogs.save(new AuditLog(cuenta.usuarioId(), AccionAuditoria.CREATE, "Turno", ID_COMPARTIDO,
					null, null));
		});
	}

	@Test
	void entidadIdAloneMatchesEveryEntityWithThatNumber() throws Exception {
		sembrarIdCompartido();

		List<String> lista = entidades(api.get(admin, "/api/auditoria?entidadId=" + ID_COMPARTIDO));

		assertThat(lista).containsExactlyInAnyOrder("READ FichaClinica " + ID_COMPARTIDO,
				"CREATE Turno " + ID_COMPARTIDO);
	}

	@Test
	void entidadIdCombinedWithEntidadIsolatesThePatientClinicalAccess() throws Exception {
		sembrarIdCompartido();

		List<String> lista = entidades(
				api.get(admin, "/api/auditoria?entidad=FichaClinica&entidadId=" + ID_COMPARTIDO));

		assertThat(lista).containsExactly("READ FichaClinica " + ID_COMPARTIDO);
	}

	@Test
	void theExportRowIsFoundByActionEntityAndPatientId() throws Exception {
		long id = export.pacienteVacio(admin);
		long otro = export.pacienteVacio(admin);
		api.get(admin, "/api/pacientes/" + id + "/export");
		api.get(admin, "/api/pacientes/" + otro + "/export");

		List<String> lista = entidades(
				api.get(admin, "/api/auditoria?accion=EXPORT&entidad=Paciente&entidadId=" + id));

		assertThat(lista).containsExactly("EXPORT Paciente " + id);
	}
}
