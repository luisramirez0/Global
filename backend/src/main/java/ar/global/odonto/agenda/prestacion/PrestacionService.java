package ar.global.odonto.agenda.prestacion;

import ar.global.odonto.agenda.Prestacion;
import ar.global.odonto.agenda.PrestacionRepository;
import ar.global.odonto.common.web.RecursoNoEncontradoException;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Prestaciones del consultorio. Sin invariantes entre filas: no necesita el lock del consultorio (D7). */
@Service
public class PrestacionService {

	private final PrestacionRepository prestaciones;

	public PrestacionService(PrestacionRepository prestaciones) {
		this.prestaciones = prestaciones;
	}

	@Transactional(readOnly = true)
	public List<PrestacionResponse> listar(boolean incluirInactivas) {
		List<Prestacion> lista = incluirInactivas ? prestaciones.findAllByOrderByNombre()
				: prestaciones.findAllByActivoTrueOrderByNombre();
		return lista.stream().map(PrestacionMapper::toResponse).toList();
	}

	@Transactional(readOnly = true)
	public PrestacionResponse obtener(Long id) {
		return PrestacionMapper.toResponse(buscar(id));
	}

	@Transactional
	public PrestacionResponse crear(PrestacionRequest request) {
		Prestacion p = new Prestacion(request.nombre().trim(), request.duracionMinutos());
		PrestacionMapper.apply(request, p);
		return PrestacionMapper.toResponse(prestaciones.saveAndFlush(p));
	}

	@Transactional
	public PrestacionResponse actualizar(Long id, PrestacionRequest request) {
		Prestacion p = buscar(id);
		PrestacionMapper.apply(request, p);
		return PrestacionMapper.toResponse(prestaciones.saveAndFlush(p));
	}

	@Transactional
	public void darDeBaja(Long id) {
		Prestacion p = buscar(id);
		p.setActivo(false);
		prestaciones.saveAndFlush(p);
	}

	private Prestacion buscar(Long id) {
		return prestaciones.findById(id).orElseThrow(RecursoNoEncontradoException::new);
	}
}
