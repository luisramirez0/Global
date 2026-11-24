package ar.global.odonto.paciente.abm;

import ar.global.odonto.common.web.Pagina;
import ar.global.odonto.common.web.RecursoNoEncontradoException;
import ar.global.odonto.paciente.Paciente;
import ar.global.odonto.paciente.PacienteRepository;
import ar.global.odonto.security.Permisos;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * ABM de pacientes (US-020, RN-PA-01..03). Todo acceso pasa por el filtro de tenant: un id de otro consultorio
 * no se encuentra y responde igual que uno inexistente (design D1, D7). Los permisos van aca y no en el
 * controller para que C-07/C-08 los hereden (RECEPCION crea/lee/edita; la baja y la reactivacion son de
 * gestion). Logs solo con ids (regla 5).
 */
@Service
public class PacienteService {

	static final int TAMANIO_POR_DEFECTO = 20;
	static final int TAMANIO_MAXIMO = 50;

	private static final Sort ORDEN = Sort.by("apellido", "nombre", "id");
	private static final Logger log = LoggerFactory.getLogger(PacienteService.class);

	private final PacienteRepository pacientes;
	private final TransactionTemplate tx;

	public PacienteService(PacienteRepository pacientes, TransactionTemplate tx) {
		this.pacientes = pacientes;
		this.tx = tx;
	}

	/**
	 * Alta. El DNI duplicado se detecta antes de insertar; si dos altas se cruzan, la UNIQUE de la base rechaza
	 * la segunda y se traduce al mismo {@code 409} (design D4). La transaccion va en {@link TransactionTemplate}
	 * para traducir el error fuera de ella, con una sesion nueva.
	 */
	@PreAuthorize(Permisos.OPERACION)
	public PacienteResponse crear(PacienteRequest req) {
		PacienteRequest datos = PacienteMapper.normalizar(req);
		verificarDniLibre(datos.dni(), null);
		try {
			PacienteResponse creado = tx.execute(s -> {
				Paciente paciente = new Paciente(datos.nombre(), datos.apellido(), datos.dni());
				PacienteMapper.aplicar(datos, paciente);
				return PacienteMapper.aResponse(pacientes.saveAndFlush(paciente));
			});
			log.info("Paciente creado id={}", creado.id());
			return creado;
		}
		catch (DataIntegrityViolationException ex) {
			throw duplicadoOrigen(ex, datos.dni(), null);
		}
	}

	@PreAuthorize(Permisos.OPERACION)
	@Transactional(readOnly = true)
	public PacienteResponse obtener(Long id) {
		return PacienteMapper.aResponse(buscarPorId(id));
	}

	/** Listado paginado; {@code page}/{@code size} fuera de rango se ajustan al limite (design D5). */
	@PreAuthorize(Permisos.OPERACION)
	@Transactional(readOnly = true)
	public Pagina<PacienteResponse> buscar(String q, boolean incluirInactivos, int page, int size) {
		CriterioBusqueda criterio = CriterioBusqueda.de(q);
		int tamanio = size < 1 ? TAMANIO_POR_DEFECTO : Math.min(size, TAMANIO_MAXIMO);
		PageRequest pagina = PageRequest.of(Math.max(page, 0), tamanio, ORDEN);
		return Pagina.de(pacientes.buscar(criterio.patron(), criterio.dniPrefijo(), incluirInactivos, pagina)
				.map(PacienteMapper::aResponse));
	}

	/** Reemplaza los datos personales y de contacto; no cambia {@code activo} (design D1). */
	@PreAuthorize(Permisos.OPERACION)
	public PacienteResponse editar(Long id, PacienteRequest req) {
		PacienteRequest datos = PacienteMapper.normalizar(req);
		try {
			PacienteResponse editado = tx.execute(s -> {
				Paciente paciente = buscarPorId(id);
				verificarDniLibre(datos.dni(), id);
				PacienteMapper.aplicar(datos, paciente);
				return PacienteMapper.aResponse(pacientes.saveAndFlush(paciente));
			});
			log.info("Paciente editado id={}", id);
			return editado;
		}
		catch (DataIntegrityViolationException ex) {
			throw duplicadoOrigen(ex, datos.dni(), id);
		}
	}

	/** Baja logica idempotente: nunca hay borrado fisico (RN-PA-03, design D6). */
	@PreAuthorize(Permisos.GESTION)
	@Transactional
	public void darDeBaja(Long id) {
		Paciente paciente = buscarPorId(id);
		if (paciente.isActivo()) {
			paciente.setActivo(false);
			log.info("Paciente dado de baja id={}", id);
		}
	}

	@PreAuthorize(Permisos.GESTION)
	@Transactional
	public void reactivar(Long id) {
		Paciente paciente = buscarPorId(id);
		if (!paciente.isActivo()) {
			paciente.setActivo(true);
			log.info("Paciente reactivado id={}", id);
		}
	}

	private Paciente buscarPorId(Long id) {
		return pacientes.findById(id).orElseThrow(RecursoNoEncontradoException::new);
	}

	private void verificarDniLibre(String dni, Long excepto) {
		pacientes.findByDni(dni).filter(otro -> !otro.getId().equals(excepto)).ifPresent(otro -> {
			throw new DniDuplicadoException(otro.getId());
		});
	}

	/** Si la violacion de integridad fue por el DNI (carrera), {@code 409}; si no, se relanza tal cual. */
	private RuntimeException duplicadoOrigen(DataIntegrityViolationException ex, String dni, Long excepto) {
		return pacientes.findByDni(dni).filter(otro -> !otro.getId().equals(excepto)).<RuntimeException>map(otro -> {
			log.info("DNI duplicado detectado por la base (alta/edicion concurrente) pacienteExistenteId={}",
					otro.getId());
			return new DniDuplicadoException(otro.getId());
		}).orElse(ex);
	}
}
