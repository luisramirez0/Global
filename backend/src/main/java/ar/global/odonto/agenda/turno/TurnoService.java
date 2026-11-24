package ar.global.odonto.agenda.turno;

import ar.global.odonto.agenda.BloqueoAgenda;
import ar.global.odonto.agenda.BloqueoAgendaRepository;
import ar.global.odonto.agenda.EstadoTurno;
import ar.global.odonto.agenda.HorarioAtencionRepository;
import ar.global.odonto.agenda.Prestacion;
import ar.global.odonto.agenda.PrestacionRepository;
import ar.global.odonto.agenda.Profesional;
import ar.global.odonto.agenda.ProfesionalRepository;
import ar.global.odonto.agenda.Sillon;
import ar.global.odonto.agenda.SillonRepository;
import ar.global.odonto.agenda.Turno;
import ar.global.odonto.agenda.TurnoRepository;
import ar.global.odonto.agenda.turno.DetectorConflictos.Conflicto;
import ar.global.odonto.agenda.turno.ReglasAgenda.BloqueoVigente;
import ar.global.odonto.agenda.turno.ReglasAgenda.FranjaAtencion;
import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.auditoria.AuditService;
import ar.global.odonto.auditoria.AuditoriaFallidaException;
import ar.global.odonto.auditoria.DetalleAuditoria;
import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.common.web.ConflictoException;
import ar.global.odonto.common.web.RecursoNoEncontradoException;
import ar.global.odonto.common.web.ReferenciaInvalidaException;
import ar.global.odonto.common.web.ValidacionException;
import ar.global.odonto.consultorio.Consultorio;
import ar.global.odonto.consultorio.ConsultorioRepository;
import ar.global.odonto.paciente.Paciente;
import ar.global.odonto.paciente.PacienteRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Motor de turnos (C-07). Toda escritura corre en una transaccion de lectura-escritura cuya PRIMERA sentencia es el
 * lock pesimista del consultorio (design D1); despues valida en el orden de design D9 (referencias → horario y
 * grilla → bloqueos → solapamiento de sillon → de profesional), escribe y audita en la misma transaccion (design D4,
 * fail-closed). Ningun metodo usa {@code @Audited}; las lecturas no se auditan y por eso pueden ser
 * {@code readOnly} (regla 5 del handoff de C-06).
 */
@Service
public class TurnoService {

	static final String ENTIDAD_AUDITADA = "Turno";
	static final String TITULO_TRANSICION = "Transición de estado inválida";
	static final String TITULO_NO_REPROGRAMABLE = "El turno no se puede reprogramar en su estado actual";
	static final String TITULO_ASISTENCIA_FUTURA = "El turno todavía no empezó";
	/** Rango maximo de la consulta de agenda (design D10). */
	static final Duration RANGO_MAXIMO = Duration.ofDays(42);

	private static final Logger log = LoggerFactory.getLogger(TurnoService.class);

	private final TurnoRepository turnos;
	private final PacienteRepository pacientes;
	private final PrestacionRepository prestaciones;
	private final SillonRepository sillones;
	private final ProfesionalRepository profesionales;
	private final HorarioAtencionRepository horarios;
	private final BloqueoAgendaRepository bloqueos;
	private final ConsultorioRepository consultorios;
	private final DetectorConflictos detector;
	private final AuditService auditoria;
	private final Clock clock;

	public TurnoService(TurnoRepository turnos, PacienteRepository pacientes, PrestacionRepository prestaciones,
			SillonRepository sillones, ProfesionalRepository profesionales, HorarioAtencionRepository horarios,
			BloqueoAgendaRepository bloqueos, ConsultorioRepository consultorios, DetectorConflictos detector,
			AuditService auditoria, Clock clock) {
		this.turnos = turnos;
		this.pacientes = pacientes;
		this.prestaciones = prestaciones;
		this.sillones = sillones;
		this.profesionales = profesionales;
		this.horarios = horarios;
		this.bloqueos = bloqueos;
		this.consultorios = consultorios;
		this.detector = detector;
		this.auditoria = auditoria;
		this.clock = clock;
	}

	// --- lecturas (no auditadas) --------------------------------------------------------------

	@Transactional(readOnly = true)
	public List<TurnoResponse> listar(Instant desde, Instant hasta, Long sillonId, Long profesionalId,
			boolean incluirCancelados) {
		if (!desde.isBefore(hasta)) {
			throw new ValidacionException("hasta", "debe ser posterior a desde");
		}
		if (Duration.between(desde, hasta).compareTo(RANGO_MAXIMO) > 0) {
			throw new ValidacionException("hasta", "el rango no puede superar 42 días");
		}
		return turnos.buscarAgenda(desde, hasta, sillonId, profesionalId, incluirCancelados).stream()
				.map(TurnoMapper::toResponse).toList();
	}

	@Transactional(readOnly = true)
	public TurnoResponse obtener(Long id) {
		return TurnoMapper.toResponse(buscar(id));
	}

	// --- escrituras ---------------------------------------------------------------------------

	@Transactional
	public TurnoResponse crear(TurnoCreateRequest request) {
		ZoneId zona = bloquearConsultorio();
		Paciente paciente = pacientes.findById(request.pacienteId()).filter(Paciente::isActivo)
				.orElseThrow(() -> new ReferenciaInvalidaException("pacienteId"));
		Prestacion prestacion = prestaciones.findById(request.prestacionId()).filter(Prestacion::isActivo)
				.orElseThrow(() -> new ReferenciaInvalidaException("prestacionId"));
		Sillon sillon = sillonActivo(request.sillonId());
		Profesional profesional = resolverProfesional(request.profesionalId());
		IntervaloTurno intervalo = new IntervaloTurno(request.inicio(),
				request.inicio().plus(Duration.ofMinutes(prestacion.getDuracionMinutos())));

		validarAgenda(intervalo, zona, sillon, profesional, request.esSobreturno(), null);

		Turno turno = turnos.saveAndFlush(new Turno(paciente, profesional, sillon, prestacion, intervalo,
				request.esSobreturno(), request.notas()));
		auditar(AccionAuditoria.CREATE, turno.getId(),
				DetalleAuditoria.vacio().con("sobreturno", turno.isEsSobreturno()));
		return TurnoMapper.toResponse(turno);
	}

	@Transactional
	public TurnoResponse cambiarEstado(Long id, TurnoEstadoRequest request) {
		bloquearConsultorio();
		Turno turno = buscar(id);
		EstadoTurno anterior = turno.getEstado();
		EstadoTurno nuevo = request.estado();
		if (request.motivoCancelacion() != null && nuevo != EstadoTurno.CANCELADO) {
			throw new ValidacionException("motivoCancelacion", "solo se admite al cancelar");
		}
		if (!TransicionesTurno.permitida(anterior, nuevo)) {
			throw new ConflictoException(TITULO_TRANSICION);
		}
		if (TransicionesTurno.requiereInicioPasado(nuevo) && turno.getInicio().isAfter(clock.instant())) {
			throw new ConflictoException(TITULO_ASISTENCIA_FUTURA);
		}

		turno.cambiarEstado(nuevo, request.motivoCancelacion());
		turnos.saveAndFlush(turno);
		auditar(AccionAuditoria.UPDATE, turno.getId(),
				DetalleAuditoria.vacio().con("operacion", OperacionTurnoAuditada.CAMBIO_ESTADO)
						.con("estadoAnterior", anterior).con("estado", nuevo));
		return TurnoMapper.toResponse(turno);
	}

	@Transactional
	public TurnoResponse reprogramar(Long id, TurnoReprogramarRequest request) {
		ZoneId zona = bloquearConsultorio();
		Turno turno = buscar(id);
		if (!TransicionesTurno.reprogramable(turno.getEstado())) {
			throw new ConflictoException(TITULO_NO_REPROGRAMABLE);
		}
		Instant inicioAnterior = turno.getInicio();
		long sillonAnterior = turno.getSillon().getId();
		long profesionalAnterior = turno.getProfesional().getId();

		Sillon sillon = sillonActivo(request.sillonId() != null ? request.sillonId() : sillonAnterior);
		Profesional profesional = profesionalActivo(
				request.profesionalId() != null ? request.profesionalId() : profesionalAnterior);
		IntervaloTurno intervalo = turno.getIntervalo().movidoA(request.inicio());

		validarAgenda(intervalo, zona, sillon, profesional, request.esSobreturno(), turno.getId());

		turno.reprogramar(sillon, profesional, intervalo, request.esSobreturno());
		turnos.saveAndFlush(turno);
		auditar(AccionAuditoria.UPDATE, turno.getId(),
				DetalleAuditoria.vacio().con("operacion", OperacionTurnoAuditada.REPROGRAMAR)
						.con("inicioAnterior", inicioAnterior.getEpochSecond())
						.con("sillonIdAnterior", sillonAnterior).con("profesionalIdAnterior", profesionalAnterior)
						.con("sobreturno", request.esSobreturno()));
		return TurnoMapper.toResponse(turno);
	}

	// --- reglas -------------------------------------------------------------------------------

	/** Design D9: horario y grilla → bloqueos → solapamientos; el sobreturno omite lo que indica design D3. */
	private void validarAgenda(IntervaloTurno intervalo, ZoneId zona, Sillon sillon, Profesional profesional,
			boolean sobreturno, Long excluirId) {
		ExcepcionesSobreturno excepciones = ExcepcionesSobreturno.para(sobreturno);
		long sillonId = sillon.getId();
		long profesionalId = profesional.getId();

		if (excepciones.verificaHorarioYGrilla()) {
			int dia = intervalo.inicio().atZone(zona).getDayOfWeek().getValue();
			List<FranjaAtencion> franjas = horarios.findByProfesionalIdAndDiaSemana(profesionalId, dia).stream()
					.map(h -> new FranjaAtencion(h.getDiaSemana(), h.getHoraDesde(), h.getHoraHasta())).toList();
			if (!ReglasAgenda.inicioAlineado(intervalo.inicio(), zona)
					|| !ReglasAgenda.cabeEnHorario(intervalo, zona, franjas)) {
				throw FueraDeAgendaException.fueraDeHorario();
			}
		}
		if (excepciones.verificaBloqueos()) {
			List<BloqueoVigente> candidatos = bloqueos
					.aplicables(intervalo.inicio(), intervalo.fin(), sillonId, profesionalId).stream()
					.map(TurnoService::bloqueoVigente).toList();
			Optional<BloqueoVigente> bloqueo = ReglasAgenda.primerBloqueoAplicable(candidatos, intervalo, sillonId,
					profesionalId);
			if (bloqueo.isPresent()) {
				throw FueraDeAgendaException.enBloqueo(bloqueo.get().id());
			}
		}
		Optional<Conflicto> conflicto = detector.primerConflicto(intervalo, sillonId, profesionalId, excepciones,
				excluirId);
		if (conflicto.isPresent()) {
			Turno otro = conflicto.get().turno();
			throw new TurnoEnConflictoException(otro.getId(), otro.getInicio(), otro.getFin(),
					otro.getSillon().getId(), otro.getProfesional().getId(), conflicto.get().motivo());
		}
	}

	private static BloqueoVigente bloqueoVigente(BloqueoAgenda b) {
		return new BloqueoVigente(b.getId(), b.getSillon() == null ? null : b.getSillon().getId(),
				b.getProfesional() == null ? null : b.getProfesional().getId(),
				new IntervaloTurno(b.getInicio(), b.getFin()));
	}

	private Sillon sillonActivo(Long sillonId) {
		return sillones.findById(sillonId).filter(Sillon::isActivo)
				.orElseThrow(() -> new ReferenciaInvalidaException("sillonId"));
	}

	private Profesional profesionalActivo(Long profesionalId) {
		return profesionales.findById(profesionalId).filter(Profesional::isActivo)
				.orElseThrow(() -> new ReferenciaInvalidaException("profesionalId"));
	}

	/** Design D8 (mismo criterio que C-04): omitido → el unico profesional activo; si no hay uno solo, 422. */
	private Profesional resolverProfesional(Long profesionalId) {
		if (profesionalId != null) {
			return profesionalActivo(profesionalId);
		}
		List<Profesional> activos = profesionales.findByActivoTrue();
		if (activos.size() != 1) {
			throw new ReferenciaInvalidaException("profesionalId");
		}
		return activos.get(0);
	}

	private Turno buscar(Long id) {
		return turnos.findById(id).orElseThrow(RecursoNoEncontradoException::new);
	}

	/** Lock pesimista del consultorio (primera sentencia de toda escritura, design D1); devuelve su zona horaria. */
	private ZoneId bloquearConsultorio() {
		Consultorio consultorio = consultorios.lockById(TenantContext.require())
				.orElseThrow(RecursoNoEncontradoException::new);
		return ZoneId.of(consultorio.getZonaHoraria());
	}

	/**
	 * Registro en la misma transaccion (fail-closed, mismo criterio que {@code AuditoriaAspect}): si falla, se
	 * revierte la operacion y responde el 500 generico. El log lleva solo ids y el tipo de error (regla 5).
	 */
	private void auditar(AccionAuditoria accion, Long turnoId, DetalleAuditoria detalle) {
		try {
			auditoria.registrar(accion, ENTIDAD_AUDITADA, turnoId, detalle);
		}
		catch (RuntimeException e) {
			log.error("Fallo de auditoria accion={} entidad={} entidadId={} consultorioId={} causa={}", accion,
					ENTIDAD_AUDITADA, turnoId, TenantContext.get().orElse(null), e.getClass().getSimpleName());
			throw new AuditoriaFallidaException();
		}
	}
}
