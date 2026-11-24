package ar.global.odonto.agenda.turno;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ar.global.odonto.agenda.BloqueoAgenda;
import ar.global.odonto.agenda.BloqueoAgendaRepository;
import ar.global.odonto.agenda.EstadoTurno;
import ar.global.odonto.agenda.HorarioAtencion;
import ar.global.odonto.agenda.HorarioAtencionRepository;
import ar.global.odonto.agenda.Prestacion;
import ar.global.odonto.agenda.PrestacionRepository;
import ar.global.odonto.agenda.Profesional;
import ar.global.odonto.agenda.ProfesionalRepository;
import ar.global.odonto.agenda.Sillon;
import ar.global.odonto.agenda.SillonRepository;
import ar.global.odonto.agenda.Turno;
import ar.global.odonto.agenda.TurnoRepository;
import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.auditoria.AuditLog;
import ar.global.odonto.auditoria.AuditLogRepository;
import ar.global.odonto.auditoria.AuditService;
import ar.global.odonto.auditoria.AuditoriaFallidaException;
import ar.global.odonto.auditoria.ContextoAuditoria;
import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.common.web.ConflictoException;
import ar.global.odonto.common.web.RecursoNoEncontradoException;
import ar.global.odonto.common.web.ReferenciaInvalidaException;
import ar.global.odonto.common.web.ValidacionException;
import ar.global.odonto.paciente.PacienteRepository;
import ar.global.odonto.testsupport.DomainFixtures;
import ar.global.odonto.testsupport.DomainFixtures.Graph;
import ar.global.odonto.testsupport.PersistenceTest;
import ar.global.odonto.testsupport.TenantFixtures;
import ar.global.odonto.testsupport.TenantFixtures.Tenants;
import ar.global.odonto.testsupport.TestClockConfig.MutableClock;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Pageable;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * {@link TurnoService} contra H2 {@code MODE=MySQL} (C-07 tareas 4.1-4.4). El seed de {@link DomainFixtures} da a
 * cada consultorio un profesional con franja lunes 09-13 local, un sillon, una prestacion de 30 min y un paciente.
 * Los turnos de estos tests son el lunes 2026-12-07 (el turno y el bloqueo del seed caen otros dias).
 */
@PersistenceTest
@Import({ TurnoService.class, DetectorConflictos.class, AuditService.class, ContextoAuditoria.class })
class TurnoServiceTest {

	private static final ZoneId BA = ZoneId.of("America/Argentina/Buenos_Aires");
	private static final String LUNES = "2026-12-07";
	private static final ObjectMapper JSON = new ObjectMapper();

	@Autowired
	private TurnoService service;

	@Autowired
	private TenantFixtures fixtures;

	@Autowired
	private DomainFixtures domain;

	@Autowired
	private TurnoRepository turnos;

	@Autowired
	private PacienteRepository pacientes;

	@Autowired
	private SillonRepository sillones;

	@Autowired
	private ProfesionalRepository profesionales;

	@Autowired
	private PrestacionRepository prestaciones;

	@Autowired
	private HorarioAtencionRepository horarios;

	@Autowired
	private BloqueoAgendaRepository bloqueos;

	@Autowired
	private AuditLogRepository auditLogs;

	@Autowired
	private MutableClock clock;

	private Tenants tenants;
	private Graph a;
	private Graph b;

	@BeforeEach
	void setUp() {
		fixtures.cleanAll();
		clock.set(Instant.parse("2026-11-23T13:00:00Z"));
		tenants = fixtures.createTenants();
		a = domain.seed(tenants.a(), "a");
		b = domain.seed(tenants.b(), "b");
	}

	@AfterEach
	void cleanUp() {
		SecurityContextHolder.clearContext();
		RequestContextHolder.resetRequestAttributes();
		fixtures.cleanAll();
	}

	// --- helpers ------------------------------------------------------------------------------

	private static Instant local(String fecha, String hora) {
		return LocalDateTime.parse(fecha + "T" + hora).atZone(BA).toInstant();
	}

	private static Instant lunes(String hora) {
		return local(LUNES, hora);
	}

	private <T> T enA(Supplier<T> block) {
		return TenantContext.runAs(tenants.a(), block);
	}

	private TurnoCreateRequest alta(String hora) {
		return new TurnoCreateRequest(a.paciente().getId(), a.prestacion().getId(), a.sillon().getId(),
				a.profesional().getId(), lunes(hora), null, null);
	}

	private TurnoCreateRequest alta(String hora, Long sillonId, Long profesionalId, Boolean sobreturno) {
		return new TurnoCreateRequest(a.paciente().getId(), a.prestacion().getId(), sillonId, profesionalId,
				lunes(hora), sobreturno, null);
	}

	private TurnoResponse crearA(TurnoCreateRequest request) {
		return enA(() -> service.crear(request));
	}

	private Sillon sillon2A() {
		return fixtures.inTenant(tenants.a(), () -> sillones.save(new Sillon("Sillon 2 a")));
	}

	/** Segundo profesional de A con franja lunes 09-13 (asi el profesional por defecto queda ambiguo). */
	private Profesional profesional2A(boolean conFranja) {
		return fixtures.inTenant(tenants.a(), () -> {
			Profesional p = profesionales.save(new Profesional("Prof", "Dos a"));
			if (conFranja) {
				horarios.save(new HorarioAtencion(p, 1, LocalTime.of(9, 0), LocalTime.of(13, 0)));
			}
			return p;
		});
	}

	private BloqueoAgenda bloqueoA(Sillon sillon, String desde, String hasta) {
		return fixtures.inTenant(tenants.a(), () -> {
			BloqueoAgenda nuevo = new BloqueoAgenda(lunes(desde), lunes(hasta));
			if (sillon != null) {
				nuevo.setSillon(sillones.getReferenceById(sillon.getId()));
			}
			return bloqueos.save(nuevo);
		});
	}

	private Turno leerA(Long id) {
		return fixtures.inTenant(tenants.a(), () -> turnos.findById(id).orElseThrow());
	}

	private long turnosEnA() {
		return fixtures.inTenant(tenants.a(), () -> turnos.count());
	}

	private <T> void desactivar(Supplier<T> cambio) {
		fixtures.inTenant(tenants.a(), cambio);
	}

	private List<AuditLog> auditoriaTurnos(Long tenant) {
		return fixtures.inTenant(tenant, () -> auditLogs.findAll(Pageable.unpaged()).getContent().stream()
				.filter(l -> "Turno".equals(l.getEntidad()))
				.sorted(java.util.Comparator.comparing(AuditLog::getId)).toList());
	}

	private static Map<String, Object> detalle(AuditLog log) throws Exception {
		return JSON.readValue(log.getDetalle(), new TypeReference<Map<String, Object>>() {
		});
	}

	private static void autenticarComo(Long usuarioId) {
		Instant now = Instant.parse("2026-11-23T13:00:00Z");
		Jwt jwt = new Jwt("t", now, now.plusSeconds(60), Map.of("alg", "HS256"),
				Map.of("sub", String.valueOf(usuarioId)));
		SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt, List.of()));
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.setRemoteAddr("10.0.0.7");
		RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
	}

	// --- 4.1 alta -----------------------------------------------------------------------------

	@Nested
	class Alta {

		@Test
		void validTurnoIsProgramadoAndEndsAfterThePrestacionDuration() {
			TurnoResponse creado = crearA(alta("10:00"));

			assertThat(creado.estado()).isEqualTo(EstadoTurno.PROGRAMADO);
			assertThat(creado.inicio()).isEqualTo(lunes("10:00"));
			assertThat(creado.fin()).isEqualTo(lunes("10:30"));
			assertThat(creado.sobreturno()).isFalse();
			assertThat(creado.sillonId()).isEqualTo(a.sillon().getId());
			assertThat(creado.profesionalId()).isEqualTo(a.profesional().getId());
			assertThat(creado.paciente().id()).isEqualTo(a.paciente().getId());
			assertThat(creado.prestacion().id()).isEqualTo(a.prestacion().getId());
			Turno guardado = leerA(creado.id());
			assertThat(guardado.getConsultorioId()).isEqualTo(tenants.a());
			assertThat(guardado.getFin()).isEqualTo(lunes("10:30"));
		}

		@Test
		void durationComesFromThePrestacion() {
			Prestacion larga = fixtures.inTenant(tenants.a(), () -> prestaciones.save(new Prestacion("Larga", 60)));

			TurnoResponse creado = crearA(new TurnoCreateRequest(a.paciente().getId(), larga.getId(),
					a.sillon().getId(), null, lunes("11:00"), false, "trae estudios"));

			assertThat(creado.fin()).isEqualTo(lunes("12:00"));
			assertThat(creado.notas()).isEqualTo("trae estudios");
		}

		@Test
		void omittedProfesionalUsesTheOnlyActiveOne() {
			TurnoResponse creado = crearA(alta("10:00", a.sillon().getId(), null, null));

			assertThat(creado.profesionalId()).isEqualTo(a.profesional().getId());
		}

		@Test
		void omittedProfesionalWithTwoOrNoActiveIsInvalid() {
			profesional2A(true);
			assertThatThrownBy(() -> crearA(alta("10:00", a.sillon().getId(), null, null)))
					.isInstanceOfSatisfying(ReferenciaInvalidaException.class,
							e -> assertThat(e.getCampo()).isEqualTo("profesionalId"));

			desactivar(() -> profesionales.findAll().stream().peek(p -> p.setActivo(false))
					.map(profesionales::save).toList());
			assertThatThrownBy(() -> crearA(alta("10:00", a.sillon().getId(), null, null)))
					.isInstanceOf(ReferenciaInvalidaException.class);
			assertThat(turnosEnA()).isEqualTo(1);
		}

		@Test
		void inactiveOrForeignProfesionalIsInvalid() {
			assertThatThrownBy(() -> crearA(alta("10:00", a.sillon().getId(), b.profesional().getId(), null)))
					.isInstanceOfSatisfying(ReferenciaInvalidaException.class,
							e -> assertThat(e.getCampo()).isEqualTo("profesionalId"));
			desactivar(() -> {
				Profesional p = profesionales.findById(a.profesional().getId()).orElseThrow();
				p.setActivo(false);
				return profesionales.save(p);
			});
			assertThatThrownBy(() -> crearA(alta("10:00"))).isInstanceOf(ReferenciaInvalidaException.class);
		}

		@Test
		void inactiveForeignOrMissingPacienteIsInvalid() {
			assertThatThrownBy(() -> crearA(new TurnoCreateRequest(b.paciente().getId(), a.prestacion().getId(),
					a.sillon().getId(), null, lunes("10:00"), null, null)))
					.isInstanceOfSatisfying(ReferenciaInvalidaException.class,
							e -> assertThat(e.getCampo()).isEqualTo("pacienteId"));
			assertThatThrownBy(() -> crearA(new TurnoCreateRequest(987654L, a.prestacion().getId(),
					a.sillon().getId(), null, lunes("10:00"), null, null)))
					.isInstanceOf(ReferenciaInvalidaException.class);
			desactivar(() -> {
				var p = pacientes.findById(a.paciente().getId()).orElseThrow();
				p.setActivo(false);
				return pacientes.save(p);
			});
			assertThatThrownBy(() -> crearA(alta("10:00")))
					.isInstanceOfSatisfying(ReferenciaInvalidaException.class,
							e -> assertThat(e.getCampo()).isEqualTo("pacienteId"));
		}

		@Test
		void inactiveOrForeignSillonIsInvalid() {
			assertThatThrownBy(() -> crearA(alta("10:00", b.sillon().getId(), null, null)))
					.isInstanceOfSatisfying(ReferenciaInvalidaException.class,
							e -> assertThat(e.getCampo()).isEqualTo("sillonId"));
			desactivar(() -> {
				Sillon s = sillones.findById(a.sillon().getId()).orElseThrow();
				s.setActivo(false);
				return sillones.save(s);
			});
			assertThatThrownBy(() -> crearA(alta("10:00")))
					.isInstanceOfSatisfying(ReferenciaInvalidaException.class,
							e -> assertThat(e.getCampo()).isEqualTo("sillonId"));
		}

		@Test
		void inactiveOrForeignPrestacionIsInvalid() {
			assertThatThrownBy(() -> crearA(new TurnoCreateRequest(a.paciente().getId(), b.prestacion().getId(),
					a.sillon().getId(), null, lunes("10:00"), null, null)))
					.isInstanceOfSatisfying(ReferenciaInvalidaException.class,
							e -> assertThat(e.getCampo()).isEqualTo("prestacionId"));
			desactivar(() -> {
				Prestacion p = prestaciones.findById(a.prestacion().getId()).orElseThrow();
				p.setActivo(false);
				return prestaciones.save(p);
			});
			assertThatThrownBy(() -> crearA(alta("10:00")))
					.isInstanceOfSatisfying(ReferenciaInvalidaException.class,
							e -> assertThat(e.getCampo()).isEqualTo("prestacionId"));
		}

		@Test
		void outsideTheFranjaIsRejectedOnInicio() {
			for (String hora : List.of("08:30", "12:45", "13:00")) {
				assertThatThrownBy(() -> crearA(alta(hora))).as(hora)
						.isInstanceOfSatisfying(FueraDeAgendaException.class, e -> {
							assertThat(e.getCampo()).isEqualTo("inicio");
							assertThat(e.getBloqueoId()).isNull();
						});
			}
			assertThat(crearA(alta("12:30")).fin()).isEqualTo(lunes("13:00"));
		}

		@Test
		void startOffTheGridIsRejected() {
			assertThatThrownBy(() -> crearA(alta("10:10"))).isInstanceOf(FueraDeAgendaException.class);
		}

		@Test
		void dayWithoutFranjaIsRejected() {
			assertThatThrownBy(() -> crearA(new TurnoCreateRequest(a.paciente().getId(), a.prestacion().getId(),
					a.sillon().getId(), null, local("2026-12-08", "10:00"), null, null)))
					.isInstanceOf(FueraDeAgendaException.class);
		}

		@Test
		void applicableBlockIsRejectedWithItsId() {
			BloqueoAgenda bloqueo = bloqueoA(a.sillon(), "11:00", "12:00");

			assertThatThrownBy(() -> crearA(alta("11:30")))
					.isInstanceOfSatisfying(FueraDeAgendaException.class, e -> {
						assertThat(e.getCampo()).isEqualTo("inicio");
						assertThat(e.getBloqueoId()).isEqualTo(bloqueo.getId());
					});
			Sillon otro = sillon2A();
			assertThat(crearA(alta("11:30", otro.getId(), null, null)).sillonId()).isEqualTo(otro.getId());
		}

		@Test
		void profesionalAndConsultorioWideBlocksAreRejectedOnAnySillon() {
			Sillon otro = sillon2A();
			Profesional segundo = profesional2A(true);
			BloqueoAgenda deProfesional = fixtures.inTenant(tenants.a(), () -> {
				BloqueoAgenda nuevo = new BloqueoAgenda(lunes("11:00"), lunes("12:00"));
				nuevo.setProfesional(profesionales.getReferenceById(a.profesional().getId()));
				return bloqueos.save(nuevo);
			});
			BloqueoAgenda general = bloqueoA(null, "09:00", "09:30");

			assertThatThrownBy(() -> crearA(alta("11:00", otro.getId(), a.profesional().getId(), null)))
					.isInstanceOfSatisfying(FueraDeAgendaException.class,
							e -> assertThat(e.getBloqueoId()).isEqualTo(deProfesional.getId()));
			assertThat(crearA(alta("11:00", otro.getId(), segundo.getId(), null)).profesionalId())
					.isEqualTo(segundo.getId());
			assertThatThrownBy(() -> crearA(alta("09:00", otro.getId(), segundo.getId(), null)))
					.isInstanceOfSatisfying(FueraDeAgendaException.class,
							e -> assertThat(e.getBloqueoId()).isEqualTo(general.getId()));
		}

		@Test
		void overlapOnTheSameSillonIsAConflictWithTheExistingTurno() {
			TurnoResponse existente = crearA(alta("10:00"));

			for (String hora : List.of("10:00", "09:45")) {
				assertThatThrownBy(() -> crearA(alta(hora))).as(hora)
						.isInstanceOfSatisfying(TurnoEnConflictoException.class, e -> {
							assertThat(e.getTurnoId()).isEqualTo(existente.id());
							assertThat(e.getMotivo()).isEqualTo(MotivoConflicto.SILLON);
							assertThat(e.getInicio()).isEqualTo(lunes("10:00"));
							assertThat(e.getFin()).isEqualTo(lunes("10:30"));
							assertThat(e.getSillonId()).isEqualTo(a.sillon().getId());
							assertThat(e.getProfesionalId()).isEqualTo(a.profesional().getId());
						});
			}
			assertThat(crearA(alta("10:30")).inicio()).isEqualTo(lunes("10:30"));
		}

		@Test
		void sameProfesionalOnAnotherSillonIsAProfesionalConflict() {
			TurnoResponse existente = crearA(alta("10:00"));
			Sillon otro = sillon2A();

			assertThatThrownBy(() -> crearA(alta("10:15", otro.getId(), a.profesional().getId(), false)))
					.isInstanceOfSatisfying(TurnoEnConflictoException.class, e -> {
						assertThat(e.getTurnoId()).isEqualTo(existente.id());
						assertThat(e.getMotivo()).isEqualTo(MotivoConflicto.PROFESIONAL);
					});
		}

		@Test
		void whenSillonAndProfesionalBothCollideTheSillonIsReported() {
			crearA(alta("10:00"));

			assertThatThrownBy(() -> crearA(alta("10:00")))
					.isInstanceOfSatisfying(TurnoEnConflictoException.class,
							e -> assertThat(e.getMotivo()).isEqualTo(MotivoConflicto.SILLON));
		}

		@Test
		void sobreturnoSkipsProfesionalHorarioAndBlocks() {
			crearA(alta("10:00"));
			Sillon otro = sillon2A();
			bloqueoA(otro, "11:00", "12:00");

			TurnoResponse mismoProfesional = crearA(alta("10:00", otro.getId(), null, true));
			TurnoResponse fueraDeHorario = crearA(alta("08:30", otro.getId(), null, true));
			TurnoResponse enBloqueo = crearA(alta("11:00", otro.getId(), null, true));
			TurnoResponse fueraDeGrilla = crearA(alta("12:10", otro.getId(), null, true));

			assertThat(List.of(mismoProfesional, fueraDeHorario, enBloqueo, fueraDeGrilla))
					.allSatisfy(t -> assertThat(t.sobreturno()).isTrue());
			assertThat(leerA(mismoProfesional.id()).isEsSobreturno()).isTrue();
		}

		@Test
		void sobreturnoNeverSkipsTheSillon() {
			TurnoResponse existente = crearA(alta("10:00"));

			assertThatThrownBy(() -> crearA(alta("10:00", a.sillon().getId(), null, true)))
					.isInstanceOfSatisfying(TurnoEnConflictoException.class, e -> {
						assertThat(e.getMotivo()).isEqualTo(MotivoConflicto.SILLON);
						assertThat(e.getTurnoId()).isEqualTo(existente.id());
					});
		}

		@Test
		void existingSobreturnoOccupiesItsSlotForNormalTurnos() {
			Sillon otro = sillon2A();
			crearA(alta("10:00"));
			TurnoResponse sobreturno = crearA(alta("10:00", otro.getId(), null, true));

			assertThatThrownBy(() -> crearA(alta("10:15", otro.getId(), profesional2A(true).getId(), false)))
					.isInstanceOfSatisfying(TurnoEnConflictoException.class,
							e -> assertThat(e.getTurnoId()).isEqualTo(sobreturno.id()));
		}

		@Test
		void validationOrderIsReferencesThenHorarioThenBlocksThenOverlaps() {
			crearA(alta("10:00"));
			bloqueoA(a.sillon(), "10:00", "11:00");

			// Bloqueo + solapamiento: gana el bloqueo (422 antes que 409).
			assertThatThrownBy(() -> crearA(alta("10:00"))).isInstanceOf(FueraDeAgendaException.class);
			// Fuera de horario + bloqueo: gana el horario (sin bloqueoId).
			bloqueoA(a.sillon(), "08:00", "09:00");
			assertThatThrownBy(() -> crearA(alta("08:30"))).isInstanceOfSatisfying(FueraDeAgendaException.class,
					e -> assertThat(e.getBloqueoId()).isNull());
			// Referencia invalida + fuera de horario: gana la referencia.
			assertThatThrownBy(() -> crearA(alta("08:30", b.sillon().getId(), null, null)))
					.isInstanceOf(ReferenciaInvalidaException.class);
		}

		@Test
		void turnoInThePastIsAllowed() {
			TurnoResponse pasado = crearA(new TurnoCreateRequest(a.paciente().getId(), a.prestacion().getId(),
					a.sillon().getId(), null, local("2026-11-16", "10:00"), null, null));

			assertThat(pasado.inicio()).isBefore(clock.instant());
		}

		@Test
		void turnoOfBInTheSameSlotDoesNotCollideInA() {
			TenantContext.runAs(tenants.b(), () -> service.crear(new TurnoCreateRequest(b.paciente().getId(),
					b.prestacion().getId(), b.sillon().getId(), null, lunes("10:00"), null, null)));

			assertThat(crearA(alta("10:00")).inicio()).isEqualTo(lunes("10:00"));
		}
	}

	// --- 4.2 cambio de estado -----------------------------------------------------------------

	@Nested
	class CambioDeEstado {

		private TurnoResponse cambiarA(Long id, EstadoTurno estado, String motivo) {
			return enA(() -> service.cambiarEstado(id, new TurnoEstadoRequest(estado, motivo)));
		}

		@Test
		void validTransitionsArePersisted() {
			TurnoResponse t = crearA(alta("10:00"));

			assertThat(cambiarA(t.id(), EstadoTurno.CONFIRMADO, null).estado()).isEqualTo(EstadoTurno.CONFIRMADO);
			assertThat(cambiarA(t.id(), EstadoTurno.CANCELADO, null).estado()).isEqualTo(EstadoTurno.CANCELADO);
			assertThat(leerA(t.id()).getEstado()).isEqualTo(EstadoTurno.CANCELADO);
		}

		@Test
		void invalidTransitionsAreConflictsAndLeaveTheTurnoUnchanged() {
			TurnoResponse t = crearA(alta("10:00"));
			cambiarA(t.id(), EstadoTurno.CONFIRMADO, null);

			assertThatThrownBy(() -> cambiarA(t.id(), EstadoTurno.PROGRAMADO, null))
					.isInstanceOf(ConflictoException.class);
			assertThatThrownBy(() -> cambiarA(t.id(), EstadoTurno.CONFIRMADO, null))
					.isInstanceOf(ConflictoException.class);
			cambiarA(t.id(), EstadoTurno.CANCELADO, null);
			assertThatThrownBy(() -> cambiarA(t.id(), EstadoTurno.CONFIRMADO, null))
					.isInstanceOf(ConflictoException.class);
			assertThat(leerA(t.id()).getEstado()).isEqualTo(EstadoTurno.CANCELADO);
		}

		@Test
		void attendanceRequiresThatTheTurnoHasStarted() {
			TurnoResponse t = crearA(alta("10:00"));

			assertThatThrownBy(() -> cambiarA(t.id(), EstadoTurno.ASISTIO, null))
					.isInstanceOf(ConflictoException.class);
			assertThatThrownBy(() -> cambiarA(t.id(), EstadoTurno.AUSENTE, null))
					.isInstanceOf(ConflictoException.class);
			assertThat(leerA(t.id()).getEstado()).isEqualTo(EstadoTurno.PROGRAMADO);

			clock.set(lunes("10:00"));
			assertThat(cambiarA(t.id(), EstadoTurno.ASISTIO, null).estado()).isEqualTo(EstadoTurno.ASISTIO);
		}

		@Test
		void absenceIsAllowedOnceTheTurnoStarted() {
			TurnoResponse t = crearA(alta("10:00"));
			clock.set(lunes("10:45"));

			assertThat(cambiarA(t.id(), EstadoTurno.AUSENTE, null).estado()).isEqualTo(EstadoTurno.AUSENTE);
		}

		@Test
		void cancellationReasonIsStoredOnlyWhenCancelling() {
			TurnoResponse t = crearA(alta("10:00"));

			assertThatThrownBy(() -> cambiarA(t.id(), EstadoTurno.CONFIRMADO, "no corresponde"))
					.isInstanceOfSatisfying(ValidacionException.class,
							e -> assertThat(e.getCampo()).isEqualTo("motivoCancelacion"));
			assertThat(leerA(t.id()).getEstado()).isEqualTo(EstadoTurno.PROGRAMADO);

			TurnoResponse cancelado = cambiarA(t.id(), EstadoTurno.CANCELADO, "pidio otro dia");
			assertThat(cancelado.motivoCancelacion()).isEqualTo("pidio otro dia");
			assertThat(leerA(t.id()).getMotivoCancelacion()).isEqualTo("pidio otro dia");
		}

		@Test
		void cancellingFreesTheSlot() {
			TurnoResponse t = crearA(alta("10:00"));
			cambiarA(t.id(), EstadoTurno.CANCELADO, null);

			assertThat(crearA(alta("10:00")).id()).isNotEqualTo(t.id());
		}

		@Test
		void turnoOfAnotherTenantIsNotFound() {
			assertThatThrownBy(() -> cambiarA(b.turno().getId(), EstadoTurno.CONFIRMADO, null))
					.isInstanceOf(RecursoNoEncontradoException.class);
			assertThat(fixtures.inTenant(tenants.b(), () -> turnos.findById(b.turno().getId()).orElseThrow())
					.getEstado()).isEqualTo(EstadoTurno.PROGRAMADO);
		}
	}

	// --- 4.3 reprogramacion -------------------------------------------------------------------

	@Nested
	class Reprogramacion {

		private TurnoResponse moverA(Long id, String hora, Long sillonId, Long profesionalId, Boolean sobreturno) {
			return enA(() -> service.reprogramar(id,
					new TurnoReprogramarRequest(lunes(hora), sillonId, profesionalId, sobreturno)));
		}

		@Test
		void movingToAFreeSlotKeepsTheDurationAndState() {
			TurnoResponse t = crearA(alta("10:00"));
			enA(() -> service.cambiarEstado(t.id(), new TurnoEstadoRequest(EstadoTurno.CONFIRMADO, null)));

			TurnoResponse movido = moverA(t.id(), "11:30", null, null, null);

			assertThat(movido.inicio()).isEqualTo(lunes("11:30"));
			assertThat(movido.fin()).isEqualTo(lunes("12:00"));
			assertThat(movido.estado()).isEqualTo(EstadoTurno.CONFIRMADO);
			assertThat(movido.sillonId()).isEqualTo(a.sillon().getId());
			assertThat(movido.profesionalId()).isEqualTo(a.profesional().getId());
		}

		@Test
		void keepsTheOriginalDurationEvenIfThePrestacionChanged() {
			TurnoResponse t = crearA(alta("10:00"));
			desactivar(() -> {
				Prestacion p = prestaciones.findById(a.prestacion().getId()).orElseThrow();
				p.setDuracionMinutos(45);
				return prestaciones.save(p);
			});

			assertThat(moverA(t.id(), "11:00", null, null, null).fin()).isEqualTo(lunes("11:30"));
		}

		@Test
		void movingOntoAnOccupiedSlotIsAConflictAndChangesNothing() {
			TurnoResponse t = crearA(alta("10:00"));
			TurnoResponse ocupante = crearA(alta("11:00"));

			assertThatThrownBy(() -> moverA(t.id(), "11:00", null, null, null))
					.isInstanceOfSatisfying(TurnoEnConflictoException.class,
							e -> assertThat(e.getTurnoId()).isEqualTo(ocupante.id()));
			assertThat(leerA(t.id()).getInicio()).isEqualTo(lunes("10:00"));
		}

		@Test
		void overlappingItsOwnPreviousSlotIsAllowed() {
			Prestacion larga = fixtures.inTenant(tenants.a(), () -> prestaciones.save(new Prestacion("Larga", 60)));
			TurnoResponse t = crearA(new TurnoCreateRequest(a.paciente().getId(), larga.getId(), a.sillon().getId(),
					null, lunes("10:00"), null, null));

			TurnoResponse movido = moverA(t.id(), "10:30", null, null, null);

			assertThat(movido.fin()).isEqualTo(lunes("11:30"));
		}

		@Test
		void changingSillonRevalidatesBlocksAndOverlaps() {
			TurnoResponse t = crearA(alta("10:00"));
			Sillon otro = sillon2A();
			BloqueoAgenda bloqueo = bloqueoA(otro, "11:00", "12:00");

			assertThatThrownBy(() -> moverA(t.id(), "11:00", otro.getId(), null, null))
					.isInstanceOfSatisfying(FueraDeAgendaException.class,
							e -> assertThat(e.getBloqueoId()).isEqualTo(bloqueo.getId()));
			TurnoResponse movido = moverA(t.id(), "10:00", otro.getId(), null, null);
			assertThat(movido.sillonId()).isEqualTo(otro.getId());
		}

		@Test
		void changingProfesionalRevalidatesHorarioUnlessSobreturno() {
			TurnoResponse t = crearA(alta("10:00"));
			Profesional sinFranja = profesional2A(false);

			assertThatThrownBy(() -> moverA(t.id(), "10:00", null, sinFranja.getId(), null))
					.isInstanceOf(FueraDeAgendaException.class);
			TurnoResponse movido = moverA(t.id(), "10:00", null, sinFranja.getId(), true);
			assertThat(movido.profesionalId()).isEqualTo(sinFranja.getId());
			assertThat(movido.sobreturno()).isTrue();
		}

		@Test
		void movingASobreturnoWithoutTheFlagRevalidatesEverything() {
			TurnoResponse t = crearA(alta("08:30", a.sillon().getId(), null, true));

			assertThatThrownBy(() -> moverA(t.id(), "08:45", null, null, false))
					.isInstanceOf(FueraDeAgendaException.class);
			TurnoResponse movido = moverA(t.id(), "09:00", null, null, null);
			assertThat(movido.sobreturno()).isFalse();
		}

		@Test
		void inactiveOrForeignTargetIsInvalid() {
			TurnoResponse t = crearA(alta("10:00"));
			Sillon otro = sillon2A();
			desactivar(() -> {
				Sillon s = sillones.findById(otro.getId()).orElseThrow();
				s.setActivo(false);
				return sillones.save(s);
			});

			assertThatThrownBy(() -> moverA(t.id(), "11:00", otro.getId(), null, null))
					.isInstanceOfSatisfying(ReferenciaInvalidaException.class,
							e -> assertThat(e.getCampo()).isEqualTo("sillonId"));
			assertThatThrownBy(() -> moverA(t.id(), "11:00", null, b.profesional().getId(), null))
					.isInstanceOfSatisfying(ReferenciaInvalidaException.class,
							e -> assertThat(e.getCampo()).isEqualTo("profesionalId"));
		}

		@Test
		void finalStatesCannotBeRescheduled() {
			TurnoResponse t = crearA(alta("10:00"));
			enA(() -> service.cambiarEstado(t.id(), new TurnoEstadoRequest(EstadoTurno.CANCELADO, null)));

			assertThatThrownBy(() -> moverA(t.id(), "11:00", null, null, null)).isInstanceOf(ConflictoException.class);
			assertThat(leerA(t.id()).getInicio()).isEqualTo(lunes("10:00"));
		}

		@Test
		void turnoOfAnotherTenantIsNotFound() {
			assertThatThrownBy(() -> moverA(b.turno().getId(), "11:00", null, null, null))
					.isInstanceOf(RecursoNoEncontradoException.class);
		}
	}

	// --- 4.4 auditoria ------------------------------------------------------------------------

	@Nested
	class Auditoria {

		@Test
		void creationIsAuditedWithTheSobreturnoFlag() throws Exception {
			TurnoResponse normal = crearA(alta("10:00"));
			TurnoResponse sobreturno = crearA(alta("08:30", a.sillon().getId(), null, true));

			List<AuditLog> logs = auditoriaTurnos(tenants.a());
			assertThat(logs).hasSize(2).allSatisfy(l -> assertThat(l.getAccion()).isEqualTo(AccionAuditoria.CREATE));
			assertThat(logs).extracting(AuditLog::getEntidadId).containsExactly(normal.id(), sobreturno.id());
			assertThat(detalle(logs.get(0))).isEqualTo(Map.of("sobreturno", false));
			assertThat(detalle(logs.get(1))).isEqualTo(Map.of("sobreturno", true));
		}

		@Test
		void stateChangeIsAuditedWithPreviousAndNewState() throws Exception {
			TurnoResponse t = crearA(alta("10:00"));
			enA(() -> service.cambiarEstado(t.id(), new TurnoEstadoRequest(EstadoTurno.CANCELADO, "texto-motivo-x")));

			AuditLog log = auditoriaTurnos(tenants.a()).get(1);
			assertThat(log.getAccion()).isEqualTo(AccionAuditoria.UPDATE);
			assertThat(log.getEntidadId()).isEqualTo(t.id());
			assertThat(detalle(log)).isEqualTo(Map.of("operacion", "CAMBIO_ESTADO", "estadoAnterior", "PROGRAMADO",
					"estado", "CANCELADO"));
			assertThat(log.getDetalle()).doesNotContain("texto-motivo-x");
		}

		@Test
		void reschedulingIsAuditedWithThePreviousPosition() throws Exception {
			TurnoResponse t = crearA(alta("10:00"));
			Sillon otro = sillon2A();
			enA(() -> service.reprogramar(t.id(), new TurnoReprogramarRequest(lunes("11:00"), otro.getId(), null,
					null)));

			AuditLog log = auditoriaTurnos(tenants.a()).get(1);
			assertThat(log.getAccion()).isEqualTo(AccionAuditoria.UPDATE);
			Map<String, Object> d = detalle(log);
			assertThat(d).containsEntry("operacion", "REPROGRAMAR").containsEntry("sobreturno", false);
			assertThat(((Number) d.get("inicioAnterior")).longValue()).isEqualTo(lunes("10:00").getEpochSecond());
			assertThat(((Number) d.get("sillonIdAnterior")).longValue()).isEqualTo(a.sillon().getId());
			assertThat(((Number) d.get("profesionalIdAnterior")).longValue()).isEqualTo(a.profesional().getId());
		}

		@Test
		void detailNeverCarriesPatientDataOrFreeText() {
			TurnoResponse t = crearA(new TurnoCreateRequest(a.paciente().getId(), a.prestacion().getId(),
					a.sillon().getId(), null, lunes("10:00"), null, "nota-libre-y"));
			enA(() -> service.cambiarEstado(t.id(), new TurnoEstadoRequest(EstadoTurno.CANCELADO, "motivo-z")));

			assertThat(auditoriaTurnos(tenants.a())).extracting(AuditLog::getDetalle)
					.allSatisfy(json -> assertThat(json).doesNotContain("Apellido a", "Pac", "DNI", "nota-libre-y",
							"motivo-z"));
		}

		@Test
		void rejectedOperationsLeaveNoAuditRow() {
			TurnoResponse t = crearA(alta("10:00"));

			assertThatThrownBy(() -> crearA(alta("10:00"))).isInstanceOf(TurnoEnConflictoException.class);
			assertThatThrownBy(() -> crearA(alta("08:30"))).isInstanceOf(FueraDeAgendaException.class);
			assertThatThrownBy(() -> crearA(alta("10:00", b.sillon().getId(), null, null)))
					.isInstanceOf(ReferenciaInvalidaException.class);
			assertThatThrownBy(() -> enA(() -> service.cambiarEstado(t.id(),
					new TurnoEstadoRequest(EstadoTurno.PROGRAMADO, null)))).isInstanceOf(ConflictoException.class);
			assertThatThrownBy(() -> enA(() -> service.reprogramar(b.turno().getId(),
					new TurnoReprogramarRequest(lunes("11:00"), null, null, null))))
					.isInstanceOf(RecursoNoEncontradoException.class);

			assertThat(auditoriaTurnos(tenants.a())).hasSize(1);
			assertThat(auditoriaTurnos(tenants.b())).isEmpty();
		}

		@Test
		void readsAreNotAudited() {
			TurnoResponse t = crearA(alta("10:00"));

			enA(() -> service.obtener(t.id()));
			enA(() -> service.listar(lunes("00:00"), lunes("23:00"), null, null, true));

			assertThat(auditoriaTurnos(tenants.a())).hasSize(1);
		}

		@Test
		void auditFailureRollsBackTheCreation() {
			autenticarComo(b.usuario().getId()); // usuario de otro consultorio: la FK compuesta rechaza el INSERT

			assertThatThrownBy(() -> crearA(alta("10:00"))).isInstanceOf(AuditoriaFallidaException.class);

			assertThat(turnosEnA()).isEqualTo(1); // solo el turno del seed
			assertThat(auditoriaTurnos(tenants.a())).isEmpty();
		}

		@Test
		void auditFailureRollsBackStateChangeAndRescheduling() {
			TurnoResponse t = crearA(alta("10:00"));
			autenticarComo(b.usuario().getId());

			assertThatThrownBy(() -> enA(() -> service.cambiarEstado(t.id(),
					new TurnoEstadoRequest(EstadoTurno.CONFIRMADO, null)))).isInstanceOf(AuditoriaFallidaException.class);
			assertThatThrownBy(() -> enA(() -> service.reprogramar(t.id(),
					new TurnoReprogramarRequest(lunes("11:00"), null, null, null))))
					.isInstanceOf(AuditoriaFallidaException.class);

			Turno intacto = leerA(t.id());
			assertThat(intacto.getEstado()).isEqualTo(EstadoTurno.PROGRAMADO);
			assertThat(intacto.getInicio()).isEqualTo(lunes("10:00"));
		}

		@Test
		void auditRowCarriesTheAuthenticatedUser() {
			autenticarComo(a.usuario().getId());

			crearA(alta("10:00"));

			assertThat(auditoriaTurnos(tenants.a())).singleElement()
					.satisfies(l -> assertThat(l.getUsuarioId()).isEqualTo(a.usuario().getId()));
		}
	}
}
