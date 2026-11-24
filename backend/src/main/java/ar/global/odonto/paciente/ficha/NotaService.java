package ar.global.odonto.paciente.ficha;

import ar.global.odonto.agenda.Profesional;
import ar.global.odonto.agenda.TurnoRepository;
import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.auditoria.AuditService;
import ar.global.odonto.auditoria.Audited;
import ar.global.odonto.auditoria.ContextoAuditoria;
import ar.global.odonto.auditoria.DetalleAuditoria;
import ar.global.odonto.common.web.Pagina;
import ar.global.odonto.common.web.ReferenciaInvalidaException;
import ar.global.odonto.paciente.NotaClinica;
import ar.global.odonto.paciente.NotaClinicaRepository;
import ar.global.odonto.paciente.Paciente;
import ar.global.odonto.security.Permisos;
import java.time.Clock;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * ZONA DE RIESGO (regla 12). Notas clinicas (US-021, design D2, D7, D8, D11). Inmutables: no hay operaciones de
 * edicion ni borrado; una correccion es una nota nueva (supuesto PA-08). Solo ADMIN/PROFESIONAL (PA-07) y con
 * consentimiento. Cada alta y cada listado quedan en {@code audit_log} como {@code NotaClinica} con
 * {@code entidadId = pacienteId}. Logs solo con ids (regla 5).
 */
@Service
public class NotaService {

	static final String ENTIDAD = "NotaClinica";
	static final int TAMANIO_POR_DEFECTO = 20;
	static final int TAMANIO_MAXIMO = 100;
	static final Sort ORDEN = Sort.by(Sort.Order.desc("fecha"), Sort.Order.desc("id"));

	private static final Logger log = LoggerFactory.getLogger(NotaService.class);

	private final PacienteClinico clinico;
	private final NotaClinicaRepository notas;
	private final ProfesionalVinculadoRepository profesionales;
	private final TurnoRepository turnos;
	private final ContextoAuditoria contexto;
	private final AuditService auditoria;
	private final Clock clock;

	public NotaService(PacienteClinico clinico, NotaClinicaRepository notas,
			ProfesionalVinculadoRepository profesionales, TurnoRepository turnos, ContextoAuditoria contexto,
			AuditService auditoria, Clock clock) {
		this.clinico = clinico;
		this.notas = notas;
		this.profesionales = profesionales;
		this.turnos = turnos;
		this.contexto = contexto;
		this.auditoria = auditoria;
		this.clock = clock;
	}

	/**
	 * Alta. El autor es el profesional activo vinculado al usuario del token ({@code 422} si no hay exactamente
	 * uno); la fecha, la del servidor; el turno, si viene, debe ser del consultorio ({@code 422}). El detalle de
	 * auditoria depende del caso, por eso {@link AuditService#registrar} y no {@code @Audited}.
	 */
	@PreAuthorize(Permisos.GESTION)
	@Transactional
	public NotaResponse crear(Long pacienteId, NotaRequest req) {
		Paciente paciente = clinico.paraEscribir(pacienteId);
		Profesional autor = autor();
		NotaClinica nota = new NotaClinica(paciente, autor, clock.instant(), req.texto());
		if (req.turnoId() != null) {
			nota.setTurno(turnos.findById(req.turnoId()).orElseThrow(() -> new ReferenciaInvalidaException("turnoId")));
		}
		NotaClinica guardada = notas.save(nota);
		DetalleAuditoria detalle = DetalleAuditoria.vacio().con("notaId", guardada.getId());
		if (req.turnoId() != null) {
			detalle = detalle.con("turnoId", req.turnoId());
		}
		auditoria.registrar(AccionAuditoria.CREATE, ENTIDAD, pacienteId, detalle);
		log.info("Nota clinica creada id={} pacienteId={}", guardada.getId(), pacienteId);
		return NotaResponse.de(guardada);
	}

	/**
	 * Listado auditado, de la mas reciente a la mas antigua. SIN {@code @Transactional}: el aspecto de
	 * {@code @Audited} abre una transaccion de lectura-escritura (regla 5 de C-06, MySQL).
	 */
	@PreAuthorize(Permisos.GESTION)
	@Audited(accion = AccionAuditoria.READ, entidad = ENTIDAD, entidadId = "#pacienteId")
	public Pagina<NotaResponse> listar(Long pacienteId, int page, int size) {
		clinico.paraLeer(pacienteId);
		int tamanio = size < 1 ? TAMANIO_POR_DEFECTO : Math.min(size, TAMANIO_MAXIMO);
		PageRequest pagina = PageRequest.of(Math.max(page, 0), tamanio, ORDEN);
		return Pagina.de(notas.findByPacienteId(pacienteId, pagina).map(NotaResponse::de));
	}

	private Profesional autor() {
		Long usuarioId = contexto.usuarioId();
		List<Profesional> vinculados = usuarioId == null ? List.of()
				: profesionales.findByUsuarioIdAndActivoTrue(usuarioId);
		if (vinculados.size() != 1) {
			throw new ProfesionalNoVinculadoException();
		}
		return vinculados.get(0);
	}
}
