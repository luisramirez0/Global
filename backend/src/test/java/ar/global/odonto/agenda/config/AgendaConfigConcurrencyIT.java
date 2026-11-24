package ar.global.odonto.agenda.config;

import static org.assertj.core.api.Assertions.assertThat;

import ar.global.odonto.agenda.horario.HorarioRequest;
import ar.global.odonto.agenda.horario.HorarioService;
import ar.global.odonto.agenda.sillon.SillonRequest;
import ar.global.odonto.agenda.sillon.SillonResponse;
import ar.global.odonto.agenda.sillon.SillonService;
import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.common.web.ConflictoException;
import ar.global.odonto.testsupport.AuthFlows;
import ar.global.odonto.testsupport.TenantFixtures;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * Design D7: los invariantes entre filas se sostienen bajo concurrencia gracias al lock del consultorio. Sin
 * {@code @Transactional} en el test; cada hilo fija el tenant y llama al servicio (una transaccion por llamada).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TenantFixtures.class, AuthFlows.class })
class AgendaConfigConcurrencyIT {

	@Autowired
	private AuthFlows auth;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private SillonService sillones;

	@Autowired
	private HorarioService horarios;

	private Long consultorio;
	private ExecutorService pool;

	@BeforeEach
	void setUp() throws Exception {
		fixtures.cleanAll();
		consultorio = auth.registrar("concurrencia@a.test").consultorioId();
		pool = Executors.newFixedThreadPool(2);
	}

	@AfterEach
	void clean() {
		pool.shutdownNow();
		fixtures.cleanAll();
	}

	/** Lanza ambas tareas a la vez y devuelve: null si tuvo exito, la excepcion si fallo. */
	private List<Throwable> enParalelo(Callable<?> uno, Callable<?> otro) throws Exception {
		CountDownLatch listos = new CountDownLatch(2);
		CountDownLatch largada = new CountDownLatch(1);
		List<Future<Throwable>> futuros = new ArrayList<>();
		for (Callable<?> tarea : List.of(uno, otro)) {
			futuros.add(pool.submit(() -> {
				TenantContext.set(consultorio);
				try {
					listos.countDown();
					largada.await();
					tarea.call();
					return null;
				}
				catch (Throwable t) {
					return t;
				}
				finally {
					TenantContext.clear();
				}
			}));
		}
		listos.await();
		largada.countDown();
		List<Throwable> resultados = new ArrayList<>();
		for (Future<Throwable> f : futuros) {
			resultados.add(f.get());
		}
		return resultados;
	}

	private static void assertExactlyOneConflict(List<Throwable> resultados) {
		assertThat(resultados.stream().filter(r -> r == null)).hasSize(1);
		assertThat(resultados.stream().filter(r -> r instanceof ConflictoException)).hasSize(1);
	}

	private List<SillonResponse> activos() {
		return TenantContext.runAs(consultorio, () -> sillones.listar(false));
	}

	@Test
	void twoSimultaneousSillonCreatesWithOneActiveYieldOneOkAndOneConflict() throws Exception {
		List<Throwable> r = enParalelo(() -> sillones.crear(new SillonRequest("Sillón B", null)),
				() -> sillones.crear(new SillonRequest("Sillón C", null)));

		assertExactlyOneConflict(r);
		assertThat(activos()).hasSize(2);
	}

	@Test
	void twoSimultaneousDeactivationsWithTwoActiveLeaveExactlyOne() throws Exception {
		TenantContext.runAs(consultorio, () -> sillones.crear(new SillonRequest("Sillón B", null)));
		List<Long> ids = activos().stream().map(SillonResponse::id).toList();
		assertThat(ids).hasSize(2);

		List<Throwable> r = enParalelo(() -> {
			sillones.darDeBaja(ids.get(0));
			return null;
		}, () -> {
			sillones.darDeBaja(ids.get(1));
			return null;
		});

		assertExactlyOneConflict(r);
		assertThat(activos()).hasSize(1);
	}

	@Test
	void twoSimultaneousOverlappingFranjasPersistExactlyOne() throws Exception {
		List<Throwable> r = enParalelo(
				() -> horarios.crear(new HorarioRequest(null, 1, LocalTime.of(9, 0), LocalTime.of(13, 0))),
				() -> horarios.crear(new HorarioRequest(null, 1, LocalTime.of(12, 0), LocalTime.of(15, 0))));

		assertExactlyOneConflict(r);
		assertThat(TenantContext.runAs(consultorio, () -> horarios.listar(null))).hasSize(1);
	}

	@Test
	void twoSimultaneousReactivationsWithOneActiveLeaveAtMostTwoActive() throws Exception {
		// Deja 1 activo (el del registro) y 2 inactivos.
		Long b = TenantContext.runAs(consultorio, () -> sillones.crear(new SillonRequest("Sillón B", null))).id();
		TenantContext.runAs(consultorio, () -> {
			sillones.darDeBaja(b);
			return null;
		});
		Long c = TenantContext.runAs(consultorio, () -> sillones.crear(new SillonRequest("Sillón C", null))).id();
		TenantContext.runAs(consultorio, () -> {
			sillones.darDeBaja(c);
			return null;
		});
		assertThat(activos()).hasSize(1);

		List<Throwable> r = enParalelo(() -> sillones.actualizar(b, new SillonRequest("Sillón B", true)),
				() -> sillones.actualizar(c, new SillonRequest("Sillón C", true)));

		assertExactlyOneConflict(r);
		assertThat(activos()).hasSize(2);
	}

	@Test
	void twoSimultaneousFranjaMovesIntoMutuallyOverlappingRangesPersistExactlyOne() throws Exception {
		Long x = TenantContext.runAs(consultorio,
				() -> horarios.crear(new HorarioRequest(null, 1, LocalTime.of(9, 0), LocalTime.of(10, 0)))).id();
		Long y = TenantContext.runAs(consultorio,
				() -> horarios.crear(new HorarioRequest(null, 1, LocalTime.of(14, 0), LocalTime.of(15, 0)))).id();

		// Cada movimiento es valido contra el estado persistido, pero entre si se solapan (11-13 vs 12-14).
		List<Throwable> r = enParalelo(
				() -> horarios.actualizar(x, new HorarioRequest(null, 1, LocalTime.of(11, 0), LocalTime.of(13, 0))),
				() -> horarios.actualizar(y, new HorarioRequest(null, 1, LocalTime.of(12, 0), LocalTime.of(14, 0))));

		assertExactlyOneConflict(r);
		var franjas = TenantContext.runAs(consultorio, () -> horarios.listar(null));
		assertThat(franjas).hasSize(2);
		for (int i = 0; i < franjas.size(); i++) {
			for (int j = i + 1; j < franjas.size(); j++) {
				assertThat(ar.global.odonto.agenda.horario.SolapamientoHorario.seSolapan(franjas.get(i).horaDesde(),
						franjas.get(i).horaHasta(), franjas.get(j).horaDesde(), franjas.get(j).horaHasta()))
						.isFalse();
			}
		}
	}
}
