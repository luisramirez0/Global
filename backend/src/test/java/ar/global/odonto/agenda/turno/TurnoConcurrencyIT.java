package ar.global.odonto.agenda.turno;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;

import ar.global.odonto.agenda.TurnoRepository;
import ar.global.odonto.auditoria.AuditService;
import ar.global.odonto.auditoria.ContextoAuditoria;
import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.testsupport.DomainFixtures;
import ar.global.odonto.testsupport.DomainFixtures.Graph;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Concurrencia DETERMINISTA del motor de turnos (C-07 design "Test de concurrencia determinista", tareas 7.1-7.2).
 * Sin {@code sleep} ni tiempos al azar: el cruce de los hilos se fuerza.
 *
 * <ol>
 * <li>El hilo A entra al servicio, toma el lock del consultorio, valida y queda DETENIDO dentro de su transaccion
 * (decorador de {@link DetectorConflictos}, solo en este test), con el lock tomado y sin haber escrito.
 * <li>Recien entonces se lanza B y se espera la PRIMERA de dos senales: B bloqueado por A segun
 * {@code information_schema.sessions.blocker_id} de H2 (un hecho de la base), o B llego a validar mientras A sigue
 * detenido (solo posible sin lock: falla en el acto).
 * <li>Se libera A: escribe, audita y confirma; B obtiene el lock, ve el conflicto y falla.
 * </ol>
 * La espera del paso 2 es por condicion; el limite de 10 s solo evita colgar la suite si algo se rompe.
 */
@PersistenceTest
@Import({ TurnoService.class, AuditService.class, ContextoAuditoria.class,
		TurnoConcurrencyIT.DetectorConPausaConfig.class })
class TurnoConcurrencyIT {

	private static final ZoneId BA = ZoneId.of("America/Argentina/Buenos_Aires");
	private static final Duration GUARDA = Duration.ofSeconds(10);

	/** Primera senal observada mientras A esta detenido. */
	enum Senal {
		B_BLOQUEADO_POR_A, B_VALIDO_SIN_ESPERAR, B_TERMINO, SIN_SENAL
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class DetectorConPausaConfig {

		@Bean
		DetectorConPausa detectorConflictos(TurnoRepository turnos) {
			return new DetectorConPausa(turnos);
		}
	}

	/**
	 * Decorador de test: la primera llamada despues de {@link #armar()} queda detenida despues de consultar
	 * conflictos (dentro de la transaccion y con el lock tomado) hasta {@link #liberar()}. Cualquier otra llamada
	 * mientras tanto se registra como "otro hilo valido sin esperar".
	 */
	static class DetectorConPausa extends DetectorConflictos {

		private final AtomicBoolean armado = new AtomicBoolean();
		private volatile boolean pausaActiva;
		private volatile CountDownLatch validoA = new CountDownLatch(1);
		private volatile CountDownLatch continuarA = new CountDownLatch(1);
		private volatile CountDownLatch otroValido = new CountDownLatch(1);

		DetectorConPausa(TurnoRepository turnos) {
			super(turnos);
		}

		void armar() {
			validoA = new CountDownLatch(1);
			continuarA = new CountDownLatch(1);
			otroValido = new CountDownLatch(1);
			armado.set(true);
		}

		void liberar() {
			continuarA.countDown();
		}

		void desarmar() {
			armado.set(false);
			liberar();
		}

		boolean esperarValidoA() throws InterruptedException {
			return validoA.await(GUARDA.toMillis(), TimeUnit.MILLISECONDS);
		}

		/** Espera acotada hasta la senal de "otro valido"; devuelve si llego. Es el paso entre sondeos. */
		boolean esperarOtroValido(long millis) throws InterruptedException {
			return otroValido.await(millis, TimeUnit.MILLISECONDS);
		}

		@Override
		public Optional<Conflicto> primerConflicto(IntervaloTurno intervalo, long sillonId, long profesionalId,
				ExcepcionesSobreturno excepciones, Long excluirId) {
			Optional<Conflicto> resultado = super.primerConflicto(intervalo, sillonId, profesionalId, excepciones,
					excluirId);
			if (armado.compareAndSet(true, false)) {
				pausaActiva = true;
				validoA.countDown();
				try {
					continuarA.await(GUARDA.toMillis() * 2, TimeUnit.MILLISECONDS);
				}
				catch (InterruptedException e) {
					Thread.currentThread().interrupt();
				}
				finally {
					pausaActiva = false;
				}
			}
			else if (pausaActiva) {
				otroValido.countDown();
			}
			return resultado;
		}
	}

	@Autowired
	private TurnoService service;

	@Autowired
	private DetectorConPausa detector;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private DomainFixtures domain;

	@Autowired
	private TurnoRepository turnos;

	@Autowired
	private JdbcTemplate jdbc;

	private ExecutorService pool;
	private Tenants tenants;
	private Graph a;
	private Graph b;

	@BeforeEach
	void setUp() {
		fixtures.cleanAll();
		tenants = fixtures.createTenants();
		a = domain.seed(tenants.a(), "a");
		b = domain.seed(tenants.b(), "b");
		pool = Executors.newFixedThreadPool(2);
	}

	@AfterEach
	void cleanUp() throws InterruptedException {
		detector.desarmar();
		pool.shutdownNow();
		pool.awaitTermination(GUARDA.toMillis(), TimeUnit.MILLISECONDS);
		fixtures.cleanAll();
	}

	// --- helpers ------------------------------------------------------------------------------

	private static Instant lunes(String hora) {
		return LocalDateTime.parse("2026-12-07T" + hora).atZone(BA).toInstant();
	}

	private static TurnoCreateRequest alta(Graph g, String hora, boolean sobreturno) {
		return new TurnoCreateRequest(g.paciente().getId(), g.prestacion().getId(), g.sillon().getId(), null,
				lunes(hora), sobreturno, null);
	}

	private <T> Future<T> enHilo(Long tenant, Supplier<T> accion) {
		return pool.submit(() -> TenantContext.runAs(tenant, accion));
	}

	private long sesionesBloqueadas() {
		return jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.sessions WHERE blocker_id IS NOT NULL",
				Long.class);
	}

	/** Sondeo por condicion (sin sleep): cada paso espera en el latch de "otro valido". */
	private Senal primeraSenal(Future<?> hiloB) throws InterruptedException {
		long limite = System.nanoTime() + GUARDA.toNanos();
		while (System.nanoTime() < limite) {
			if (detector.esperarOtroValido(0)) {
				return Senal.B_VALIDO_SIN_ESPERAR;
			}
			if (sesionesBloqueadas() > 0) {
				return Senal.B_BLOQUEADO_POR_A;
			}
			if (hiloB.isDone()) {
				return Senal.B_TERMINO;
			}
			if (detector.esperarOtroValido(5)) {
				return Senal.B_VALIDO_SIN_ESPERAR;
			}
		}
		return Senal.SIN_SENAL;
	}

	/**
	 * Corre A hasta detenerlo con el lock tomado, lanza B, exige que B quede bloqueado por A y libera A. Devuelve
	 * los dos resultados (el de B puede ser una excepcion).
	 */
	private <A, B> Resultados<A, B> cruzar(Long tenantA, Supplier<A> accionA, Long tenantB, Supplier<B> accionB)
			throws Exception {
		detector.armar();
		Future<A> hiloA = enHilo(tenantA, accionA);
		assertThat(detector.esperarValidoA()).as("A llega a validar y queda detenido").isTrue();

		Future<B> hiloB = enHilo(tenantB, accionB);
		Senal senal = primeraSenal(hiloB);
		if (senal != Senal.B_BLOQUEADO_POR_A) {
			detector.liberar();
			fail("B debia quedar bloqueado por el lock de A, pero la primera senal fue " + senal);
		}

		detector.liberar();
		return new Resultados<>(resultado(hiloA), resultado(hiloB));
	}

	private static Object resultado(Future<?> f) throws InterruptedException, java.util.concurrent.TimeoutException {
		try {
			return f.get(GUARDA.toMillis(), TimeUnit.MILLISECONDS);
		}
		catch (ExecutionException e) {
			return e.getCause();
		}
	}

	record Resultados<A, B>(Object a, Object b) {
	}

	private long turnosEn(Long tenant, String hora) {
		return fixtures.inTenant(tenant, () -> turnos.findAll().stream()
				.filter(t -> t.getInicio().equals(lunes(hora))).count());
	}

	private long creates(Long tenant) {
		return jdbc.queryForObject(
				"SELECT COUNT(*) FROM audit_log WHERE consultorio_id = ? AND entidad = 'Turno' AND accion = 'CREATE'",
				Long.class, tenant);
	}

	private TurnoResponse crearDirecto(Graph g, String hora) {
		return TenantContext.runAs(g == a ? tenants.a() : tenants.b(), () -> service.crear(alta(g, hora, false)));
	}

	// --- 7.1 dos altas ------------------------------------------------------------------------

	@Test
	void twoOverlappingCreationsAtOnceLeaveExactlyOneTurno() throws Exception {
		Resultados<TurnoResponse, TurnoResponse> r = cruzar(
				tenants.a(), () -> service.crear(alta(a, "10:00", false)),
				tenants.a(), () -> service.crear(alta(a, "10:15", false)));

		assertThat(r.a()).isInstanceOf(TurnoResponse.class);
		long ganador = ((TurnoResponse) r.a()).id();
		assertThat(r.b()).isInstanceOfSatisfying(TurnoEnConflictoException.class, e -> {
			assertThat(e.getTurnoId()).isEqualTo(ganador);
			assertThat(e.getMotivo()).isEqualTo(MotivoConflicto.SILLON);
		});
		assertThat(turnosEn(tenants.a(), "10:00")).isEqualTo(1);
		assertThat(turnosEn(tenants.a(), "10:15")).isZero();
		assertThat(creates(tenants.a())).isEqualTo(1);
	}

	// --- 7.2 reprogramaciones, mixto, sobreturnos y consultorios distintos --------------------

	@Test
	void twoReschedulingsToTheSameSlotMoveOnlyOne() throws Exception {
		TurnoResponse t1 = crearDirecto(a, "09:00");
		TurnoResponse t2 = crearDirecto(a, "09:30");
		TurnoReprogramarRequest aLasOnce = new TurnoReprogramarRequest(lunes("11:00"), null, null, null);

		Resultados<TurnoResponse, TurnoResponse> r = cruzar(
				tenants.a(), () -> service.reprogramar(t1.id(), aLasOnce),
				tenants.a(), () -> service.reprogramar(t2.id(), aLasOnce));

		assertThat(r.a()).isInstanceOf(TurnoResponse.class);
		assertThat(r.b()).isInstanceOfSatisfying(TurnoEnConflictoException.class,
				e -> assertThat(e.getTurnoId()).isEqualTo(t1.id()));
		assertThat(fixtures.inTenant(tenants.a(), () -> turnos.findById(t2.id()).orElseThrow()).getInicio())
				.isEqualTo(lunes("09:30"));
		assertThat(turnosEn(tenants.a(), "11:00")).isEqualTo(1);
	}

	@Test
	void creationVersusReschedulingToTheSameSlot() throws Exception {
		TurnoResponse existente = crearDirecto(a, "09:00");

		Resultados<TurnoResponse, TurnoResponse> r = cruzar(
				tenants.a(), () -> service.crear(alta(a, "11:00", false)),
				tenants.a(), () -> service.reprogramar(existente.id(),
						new TurnoReprogramarRequest(lunes("11:00"), null, null, null)));

		assertThat(r.a()).isInstanceOf(TurnoResponse.class);
		assertThat(r.b()).isInstanceOf(TurnoEnConflictoException.class);
		assertThat(fixtures.inTenant(tenants.a(), () -> turnos.findById(existente.id()).orElseThrow()).getInicio())
				.isEqualTo(lunes("09:00"));
		assertThat(turnosEn(tenants.a(), "11:00")).isEqualTo(1);
	}

	@Test
	void twoSobreturnosOnTheSameSillonStillCollide() throws Exception {
		Resultados<TurnoResponse, TurnoResponse> r = cruzar(
				tenants.a(), () -> service.crear(alta(a, "08:30", true)),
				tenants.a(), () -> service.crear(alta(a, "08:30", true)));

		assertThat(r.a()).isInstanceOf(TurnoResponse.class);
		assertThat(r.b()).isInstanceOfSatisfying(TurnoEnConflictoException.class,
				e -> assertThat(e.getMotivo()).isEqualTo(MotivoConflicto.SILLON));
		assertThat(turnosEn(tenants.a(), "08:30")).isEqualTo(1);
	}

	@Test
	void anotherConsultorioIsNotBlockedWhileAHoldsItsLock() throws Exception {
		detector.armar();
		Future<TurnoResponse> hiloA = enHilo(tenants.a(), () -> service.crear(alta(a, "10:00", false)));
		assertThat(detector.esperarValidoA()).isTrue();

		// A sigue detenido con el lock de SU consultorio: B (otro consultorio) termina sin esperarlo.
		Future<TurnoResponse> hiloB = enHilo(tenants.b(), () -> service.crear(alta(b, "10:00", false)));
		Object resultadoB = resultado(hiloB);
		assertThat(hiloA.isDone()).as("A sigue detenido mientras B termina").isFalse();
		detector.liberar();

		assertThat(resultadoB).isInstanceOf(TurnoResponse.class);
		assertThat(resultado(hiloA)).isInstanceOf(TurnoResponse.class);
		assertThat(turnosEn(tenants.a(), "10:00")).isEqualTo(1);
		assertThat(turnosEn(tenants.b(), "10:00")).isEqualTo(1);
	}

	@Test
	void sessionsViewIsVisibleToTheTestUser() {
		// Precondicion del metodo: si H2 no expusiera blocker_id o solo mostrara la sesion propia, la senal
		// "B bloqueado" nunca llegaria. Sin sesiones bloqueadas en reposo.
		assertThat(sesionesBloqueadas()).isZero();
		assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.sessions", Long.class))
				.isGreaterThanOrEqualTo(1);
	}
}
