package ar.global.odonto.paciente.abm;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.paciente.PacienteRepository;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;

/**
 * Spec patient-management "Altas simultáneas con el mismo DNI" (design D4): la UNIQUE de la base resuelve la
 * carrera y el servicio la traduce a {@link DniDuplicadoException}.
 */
@PersistenceTest
@Import(PacienteService.class)
class PacienteServiceConcurrencyTest {

	private static final int RONDAS = 5;

	@Autowired
	private PacienteService service;

	@Autowired
	private PacienteRepository pacientes;

	@Autowired
	private TenantFixtures fixtures;

	private Tenants tenants;

	@BeforeEach
	void setUp() {
		fixtures.cleanAll();
		tenants = fixtures.createTenants();
	}

	@AfterEach
	void cleanUp() {
		fixtures.cleanAll();
	}

	@Test
	void twoSimultaneousCreatesWithTheSameDniLeaveOnePatient() throws Exception {
		ExecutorService pool = Executors.newFixedThreadPool(2);
		try {
			for (int ronda = 0; ronda < RONDAS; ronda++) {
				String dni = "3011122" + ronda;
				CyclicBarrier largada = new CyclicBarrier(2);
				List<Future<String>> resultados = new ArrayList<>();
				for (int i = 0; i < 2; i++) {
					String nombre = "Hilo" + i;
					resultados.add(pool.submit(() -> {
						largada.await(5, TimeUnit.SECONDS);
						try {
							TenantContext.runAs(tenants.a(), () -> service
									.crear(new PacienteRequest(nombre, "Perez", dni, null, null, null, null, null, null)));
							return "ok";
						}
						catch (DniDuplicadoException ex) {
							return "duplicado";
						}
					}));
				}
				List<String> salida = new ArrayList<>();
				for (Future<String> f : resultados) {
					salida.add(f.get(30, TimeUnit.SECONDS));
				}

				assertThat(salida).containsExactlyInAnyOrder("ok", "duplicado");
				assertThat(fixtures.inTenant(tenants.a(), () -> pacientes.findByDni(dni))).isPresent();
			}
			assertThat(fixtures.inTenant(tenants.a(), () -> pacientes.count())).isEqualTo(RONDAS);
		}
		finally {
			pool.shutdownNow();
		}
	}
}
