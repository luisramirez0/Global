package ar.global.odonto.agenda.bloqueo;

import ar.global.odonto.agenda.BloqueoAgenda;
import ar.global.odonto.agenda.BloqueoAgendaRepository;
import ar.global.odonto.agenda.Profesional;
import ar.global.odonto.agenda.ProfesionalRepository;
import ar.global.odonto.agenda.Sillon;
import ar.global.odonto.agenda.SillonRepository;
import ar.global.odonto.common.web.RecursoNoEncontradoException;
import ar.global.odonto.common.web.ReferenciaInvalidaException;
import ar.global.odonto.common.web.ValidacionException;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Bloqueos de agenda (design D9). Sin invariantes entre filas (los solapados se permiten): sin lock. Sillon y
 * profesional referenciados pueden estar inactivos; deben existir en el consultorio (si no, 422). El motivo
 * no se loguea (regla 5).
 */
@Service
public class BloqueoService {

	private final BloqueoAgendaRepository bloqueos;
	private final SillonRepository sillones;
	private final ProfesionalRepository profesionales;

	public BloqueoService(BloqueoAgendaRepository bloqueos, SillonRepository sillones,
			ProfesionalRepository profesionales) {
		this.bloqueos = bloqueos;
		this.sillones = sillones;
		this.profesionales = profesionales;
	}

	@Transactional(readOnly = true)
	public List<BloqueoResponse> listar(Instant desde, Instant hasta, Long sillonId, Long profesionalId) {
		return bloqueos.buscar(desde, hasta, sillonId, profesionalId).stream().map(BloqueoMapper::toResponse)
				.toList();
	}

	@Transactional(readOnly = true)
	public BloqueoResponse obtener(Long id) {
		return BloqueoMapper.toResponse(buscar(id));
	}

	@Transactional
	public BloqueoResponse crear(BloqueoRequest request) {
		validarRango(request);
		Sillon sillon = resolverSillon(request.sillonId());
		Profesional profesional = resolverProfesional(request.profesionalId());
		BloqueoAgenda b = new BloqueoAgenda(request.inicio(), request.fin());
		BloqueoMapper.apply(request, sillon, profesional, b);
		return BloqueoMapper.toResponse(bloqueos.saveAndFlush(b));
	}

	@Transactional
	public BloqueoResponse actualizar(Long id, BloqueoRequest request) {
		BloqueoAgenda b = buscar(id);
		validarRango(request);
		Sillon sillon = resolverSillon(request.sillonId());
		Profesional profesional = resolverProfesional(request.profesionalId());
		BloqueoMapper.apply(request, sillon, profesional, b);
		return BloqueoMapper.toResponse(bloqueos.saveAndFlush(b));
	}

	@Transactional
	public void borrar(Long id) {
		bloqueos.delete(buscar(id));
	}

	private static void validarRango(BloqueoRequest r) {
		if (!r.fin().isAfter(r.inicio())) {
			throw new ValidacionException("fin", "debe ser posterior a inicio");
		}
	}

	private Sillon resolverSillon(Long sillonId) {
		if (sillonId == null) {
			return null;
		}
		return sillones.findById(sillonId).orElseThrow(() -> new ReferenciaInvalidaException("sillonId"));
	}

	private Profesional resolverProfesional(Long profesionalId) {
		if (profesionalId == null) {
			return null;
		}
		return profesionales.findById(profesionalId)
				.orElseThrow(() -> new ReferenciaInvalidaException("profesionalId"));
	}

	private BloqueoAgenda buscar(Long id) {
		return bloqueos.findById(id).orElseThrow(RecursoNoEncontradoException::new);
	}
}
