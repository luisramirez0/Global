package ar.global.odonto.agenda.horario;

import ar.global.odonto.agenda.HorarioAtencion;
import ar.global.odonto.agenda.HorarioAtencionRepository;
import ar.global.odonto.agenda.Profesional;
import ar.global.odonto.agenda.ProfesionalRepository;
import ar.global.odonto.agenda.config.GrillaAgenda;
import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.common.web.ConflictoException;
import ar.global.odonto.common.web.RecursoNoEncontradoException;
import ar.global.odonto.common.web.ReferenciaInvalidaException;
import ar.global.odonto.common.web.ValidacionException;
import ar.global.odonto.consultorio.ConsultorioRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Franjas de atencion (C-04 design D7/D8). Alta y edicion toman el lock del consultorio como primera
 * sentencia y luego validan: forma de las horas (400), profesional (422), solapamiento (409).
 */
@Service
public class HorarioService {

	static final String TITULO_SOLAPAMIENTO = "Franja de atención solapada";

	private final HorarioAtencionRepository horarios;
	private final ProfesionalRepository profesionales;
	private final ConsultorioRepository consultorios;

	public HorarioService(HorarioAtencionRepository horarios, ProfesionalRepository profesionales,
			ConsultorioRepository consultorios) {
		this.horarios = horarios;
		this.profesionales = profesionales;
		this.consultorios = consultorios;
	}

	@Transactional(readOnly = true)
	public List<HorarioResponse> listar(Long profesionalId) {
		List<HorarioAtencion> lista = profesionalId == null ? horarios.findAllByOrderByDiaSemanaAscHoraDesdeAsc()
				: horarios.findAllByProfesionalIdOrderByDiaSemanaAscHoraDesdeAsc(profesionalId);
		return lista.stream().map(HorarioMapper::toResponse).toList();
	}

	@Transactional(readOnly = true)
	public HorarioResponse obtener(Long id) {
		return HorarioMapper.toResponse(buscar(id));
	}

	@Transactional
	public HorarioResponse crear(HorarioRequest request) {
		bloquearConsultorio();
		validarHoras(request);
		Profesional profesional = resolverProfesional(request.profesionalId());
		validarSolapamiento(null, profesional.getId(), request);
		HorarioAtencion h = new HorarioAtencion(profesional, request.diaSemana(), request.horaDesde(),
				request.horaHasta());
		return HorarioMapper.toResponse(horarios.saveAndFlush(h));
	}

	@Transactional
	public HorarioResponse actualizar(Long id, HorarioRequest request) {
		bloquearConsultorio();
		HorarioAtencion h = buscar(id);
		validarHoras(request);
		Profesional profesional = resolverProfesional(request.profesionalId());
		validarSolapamiento(h.getId(), profesional.getId(), request);
		HorarioMapper.apply(request, profesional, h);
		return HorarioMapper.toResponse(horarios.saveAndFlush(h));
	}

	/** Borrado fisico (configuracion sin valor historico, C-02 design). */
	@Transactional
	public void borrar(Long id) {
		horarios.delete(buscar(id));
	}

	private void validarHoras(HorarioRequest r) {
		if (!r.horaDesde().isBefore(r.horaHasta())) {
			throw new ValidacionException("horaHasta", "debe ser posterior a horaDesde");
		}
		if (!GrillaAgenda.alineada(r.horaDesde())) {
			throw new ValidacionException("horaDesde", "debe estar alineada a la grilla de la agenda");
		}
		if (!GrillaAgenda.alineada(r.horaHasta())) {
			throw new ValidacionException("horaHasta", "debe estar alineada a la grilla de la agenda");
		}
	}

	/** Design D8: omitido -> el unico profesional activo; indicado -> existente en el tenant y activo. */
	private Profesional resolverProfesional(Long profesionalId) {
		if (profesionalId == null) {
			List<Profesional> activos = profesionales.findByActivoTrue();
			if (activos.size() != 1) {
				throw new ReferenciaInvalidaException("profesionalId");
			}
			return activos.get(0);
		}
		return profesionales.findById(profesionalId).filter(Profesional::isActivo)
				.orElseThrow(() -> new ReferenciaInvalidaException("profesionalId"));
	}

	private void validarSolapamiento(Long propioId, Long profesionalId, HorarioRequest r) {
		boolean solapa = horarios.findByProfesionalIdAndDiaSemana(profesionalId, r.diaSemana()).stream()
				.filter(otra -> !otra.getId().equals(propioId))
				.anyMatch(otra -> SolapamientoHorario.seSolapan(r.horaDesde(), r.horaHasta(), otra.getHoraDesde(),
						otra.getHoraHasta()));
		if (solapa) {
			throw new ConflictoException(TITULO_SOLAPAMIENTO);
		}
	}

	private HorarioAtencion buscar(Long id) {
		return horarios.findById(id).orElseThrow(RecursoNoEncontradoException::new);
	}

	private void bloquearConsultorio() {
		consultorios.lockById(TenantContext.require()).orElseThrow(RecursoNoEncontradoException::new);
	}
}
