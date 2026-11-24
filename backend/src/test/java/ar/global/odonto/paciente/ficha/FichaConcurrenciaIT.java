package ar.global.odonto.paciente.ficha;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.paciente.ficha.FichaFixtures.Fila;
import ar.global.odonto.testsupport.ApiCalls;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TestTokens;
import ar.global.odonto.usuario.Rol;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.RepeatedTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/** Spec clinical-record "Edición concurrente de la ficha", escenario "Guardados simultáneos" (design D6). */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class, TestTokens.class, ApiCalls.class, FichaFixtures.class })
class FichaConcurrenciaIT {

	@Autowired
	private ApiCalls api;

	@Autowired
	private AuthFlows auth;

	@Autowired
	private TestTokens tokens;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private FichaFixtures ficha;

	private AuthFlows.Cuenta cuenta;

	private String profesional;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		cuenta = auth.registrar("ficha-concurrencia@consultorio.test");
		profesional = tokens.bearer(cuenta.usuarioId(), cuenta.consultorioId(), Rol.PROFESIONAL);
	}

	@AfterEach
	void clean() {
		fixtures.cleanAll();
	}

	private String body(String alergias, Long version) {
		var node = api.mapper.createObjectNode().put("alergias", alergias);
		if (version == null) {
			node.putNull("version");
		}
		else {
			node.put("version", version);
		}
		return node.toString();
	}

	/** Lanza dos PUT a la vez y devuelve sus estados. */
	private List<Integer> dosALaVez(long pacienteId, String b1, String b2) throws Exception {
		String url = "/api/pacientes/" + pacienteId + "/ficha";
		CountDownLatch largada = new CountDownLatch(1);
		ExecutorService pool = Executors.newFixedThreadPool(2);
		try {
			List<Future<Integer>> futuros = new ArrayList<>();
			for (String b : List.of(b1, b2)) {
				Callable<Integer> tarea = () -> {
					largada.await();
					return api.put(profesional, url, b).getStatus();
				};
				futuros.add(pool.submit(tarea));
			}
			largada.countDown();
			List<Integer> estados = new ArrayList<>();
			for (Future<Integer> f : futuros) {
				estados.add(f.get(30, TimeUnit.SECONDS));
			}
			return estados;
		}
		finally {
			pool.shutdownNow();
		}
	}

	private List<String> escriturasAuditadas() {
		return ficha.auditoriaClinica(cuenta.consultorioId()).stream().filter(f -> f.entidad().equals("FichaClinica"))
				.map(Fila::accion).filter(a -> !a.equals("READ")).toList();
	}

	@RepeatedTest(3)
	void twoSimultaneousUpdatesWithTheSameVersionLetOnlyOneWin() throws Exception {
		long pacienteId = ficha.crearPaciente(profesional);
		ficha.consentir(profesional, pacienteId);
		assertThat(api.put(profesional, "/api/pacientes/" + pacienteId + "/ficha", body("inicial", null)).getStatus())
				.isEqualTo(200);

		List<Integer> estados = dosALaVez(pacienteId, body("uno", 0L), body("dos", 0L));

		assertThat(estados).containsExactlyInAnyOrder(200, 409);
		assertThat(((Number) ficha.filaFicha(pacienteId).get("VERSION")).longValue()).isEqualTo(1);
		assertThat(escriturasAuditadas()).containsExactly("CREATE", "UPDATE");
	}

	@RepeatedTest(3)
	void twoSimultaneousFirstLoadsCreateASingleFicha() throws Exception {
		long pacienteId = ficha.crearPaciente(profesional);
		ficha.consentir(profesional, pacienteId);

		List<Integer> estados = dosALaVez(pacienteId, body("uno", null), body("dos", null));

		assertThat(estados).containsExactlyInAnyOrder(200, 409);
		assertThat(ficha.contar("ficha_clinica", pacienteId)).isEqualTo(1);
		assertThat(escriturasAuditadas()).containsExactly("CREATE");
	}
}
