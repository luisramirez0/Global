package ar.global.odonto.agenda.sillon;

import ar.global.odonto.agenda.Sillon;
import ar.global.odonto.agenda.SillonRepository;
import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.common.web.ConflictoException;
import ar.global.odonto.common.web.RecursoNoEncontradoException;
import ar.global.odonto.consultorio.ConsultorioRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sillones del consultorio (C-04 design D7). Toda escritura toma el lock del consultorio como PRIMERA
 * sentencia de la transaccion, antes de leer o contar, para que el limite de activos sea correcto bajo
 * concurrencia.
 */
@Service
public class SillonService {

	static final String TITULO_LIMITE = "Límite de sillones activos";
	static final String TITULO_ULTIMO = "Debe quedar al menos un sillón activo";

	private final SillonRepository sillones;
	private final ConsultorioRepository consultorios;

	public SillonService(SillonRepository sillones, ConsultorioRepository consultorios) {
		this.sillones = sillones;
		this.consultorios = consultorios;
	}

	@Transactional(readOnly = true)
	public List<SillonResponse> listar(boolean incluirInactivos) {
		List<Sillon> lista = incluirInactivos ? sillones.findAllByOrderByNombre()
				: sillones.findAllByActivoTrueOrderByNombre();
		return lista.stream().map(SillonMapper::toResponse).toList();
	}

	@Transactional(readOnly = true)
	public SillonResponse obtener(Long id) {
		return SillonMapper.toResponse(buscar(id));
	}

	@Transactional
	public SillonResponse crear(SillonRequest request) {
		bloquearConsultorio();
		if (!LimiteSillones.permiteActivar(sillones.countByActivoTrue())) {
			throw new ConflictoException(TITULO_LIMITE);
		}
		Sillon sillon = new Sillon(request.nombre().trim());
		sillon.setActivo(true);
		return SillonMapper.toResponse(sillones.saveAndFlush(sillon));
	}

	@Transactional
	public SillonResponse actualizar(Long id, SillonRequest request) {
		bloquearConsultorio();
		Sillon sillon = buscar(id);
		boolean destino = request.activo() == null ? sillon.isActivo() : request.activo();
		cambiarActivo(sillon, destino);
		SillonMapper.apply(request, sillon);
		return SillonMapper.toResponse(sillones.saveAndFlush(sillon));
	}

	/** Baja logica (idempotente sobre un sillon ya inactivo). */
	@Transactional
	public void darDeBaja(Long id) {
		bloquearConsultorio();
		Sillon sillon = buscar(id);
		cambiarActivo(sillon, false);
		sillones.saveAndFlush(sillon);
	}

	private void cambiarActivo(Sillon sillon, boolean destino) {
		if (sillon.isActivo() == destino) {
			return;
		}
		long activos = sillones.countByActivoTrue();
		if (destino && !LimiteSillones.permiteActivar(activos)) {
			throw new ConflictoException(TITULO_LIMITE);
		}
		if (!destino && !LimiteSillones.permiteDesactivar(activos)) {
			throw new ConflictoException(TITULO_ULTIMO);
		}
		sillon.setActivo(destino);
	}

	private Sillon buscar(Long id) {
		return sillones.findById(id).orElseThrow(RecursoNoEncontradoException::new);
	}

	private void bloquearConsultorio() {
		consultorios.lockById(TenantContext.require()).orElseThrow(RecursoNoEncontradoException::new);
	}
}
