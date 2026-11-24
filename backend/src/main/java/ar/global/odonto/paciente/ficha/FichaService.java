package ar.global.odonto.paciente.ficha;

import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.auditoria.AuditService;
import ar.global.odonto.auditoria.Audited;
import ar.global.odonto.auditoria.DetalleAuditoria;
import ar.global.odonto.paciente.FichaClinica;
import ar.global.odonto.paciente.FichaClinicaRepository;
import ar.global.odonto.paciente.Paciente;
import ar.global.odonto.security.Permisos;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * ZONA DE RIESGO (regla 12). Ficha clinica / anamnesis (US-021, design D4-D6, D8, D13). Solo ADMIN/PROFESIONAL
 * (PA-07); requiere consentimiento (RN-DS-03). Cada acceso exitoso queda en {@code audit_log} como
 * {@code FichaClinica} con {@code entidadId = pacienteId} (RN-DS-02). Logs solo con ids (regla 5).
 */
@Service
public class FichaService {

	static final String ENTIDAD = "FichaClinica";

	private static final Logger log = LoggerFactory.getLogger(FichaService.class);

	private final PacienteClinico clinico;
	private final FichaClinicaRepository fichas;
	private final AuditService auditoria;
	private final TransactionTemplate tx;

	public FichaService(PacienteClinico clinico, FichaClinicaRepository fichas, AuditService auditoria,
			TransactionTemplate tx) {
		this.clinico = clinico;
		this.fichas = fichas;
		this.auditoria = auditoria;
		this.tx = tx;
	}

	/**
	 * Lectura auditada. SIN {@code @Transactional}: el aspecto de {@code @Audited} abre una transaccion de
	 * lectura-escritura para el INSERT de auditoria; {@code readOnly = true} lo haria fallar en MySQL (regla 5 de
	 * C-06).
	 */
	@PreAuthorize(Permisos.GESTION)
	@Audited(accion = AccionAuditoria.READ, entidad = ENTIDAD, entidadId = "#pacienteId")
	public FichaResponse obtener(Long pacienteId) {
		clinico.paraLeer(pacienteId);
		return fichas.findByPacienteId(pacienteId).map(f -> FichaMapper.aResponse(pacienteId, f))
				.orElseGet(() -> FichaResponse.vacia(pacienteId));
	}

	/**
	 * Primera carga ({@code CREATE}) o reemplazo ({@code UPDATE}) segun {@link ReglasFicha} (design D6). La
	 * transaccion va en {@link TransactionTemplate} para traducir FUERA de ella las carreras (bloqueo optimista o
	 * UNIQUE de {@code paciente_id}) a {@code 409}; por eso se audita con {@link AuditService#registrar} y no con
	 * {@code @Audited} (regla 6 de C-06).
	 */
	@PreAuthorize(Permisos.GESTION)
	public FichaResponse guardar(Long pacienteId, FichaRequest req) {
		AtomicReference<OperacionFicha> operacion = new AtomicReference<>();
		try {
			FichaResponse guardada = tx.execute(s -> {
				Paciente paciente = clinico.paraEscribir(pacienteId);
				Optional<FichaClinica> actual = fichas.findByPacienteId(pacienteId);
				operacion.set(ReglasFicha.decidir(actual.map(FichaClinica::getVersion).orElse(null), req.version()));
				FichaClinica ficha = actual.orElseGet(() -> new FichaClinica(paciente));
				FichaMapper.aplicar(req, ficha);
				FichaClinica g = fichas.saveAndFlush(ficha);
				AccionAuditoria accion = operacion.get() == OperacionFicha.CREAR ? AccionAuditoria.CREATE
						: AccionAuditoria.UPDATE;
				auditoria.registrar(accion, ENTIDAD, pacienteId,
						DetalleAuditoria.vacio().con("fichaId", g.getId()).con("version", g.getVersion()));
				return FichaMapper.aResponse(pacienteId, g);
			});
			log.info("Ficha clinica guardada pacienteId={} operacion={}", pacienteId, operacion.get());
			return guardada;
		}
		catch (ObjectOptimisticLockingFailureException ex) {
			log.info("Edicion concurrente de ficha rechazada pacienteId={}", pacienteId);
			throw new FichaDesactualizadaException();
		}
		catch (DataIntegrityViolationException ex) {
			// Solo una primera carga que perdio la carrera contra otra (ya hay ficha) es 409; cualquier otra
			// violacion (p. ej. el INSERT de auditoria rechazado) se relanza: fail-closed, 500.
			if (operacion.get() == OperacionFicha.CREAR && existeFicha(pacienteId)) {
				log.info("Primera carga concurrente de ficha rechazada pacienteId={}", pacienteId);
				throw new FichaDesactualizadaException();
			}
			throw ex;
		}
	}

	private boolean existeFicha(Long pacienteId) {
		return Boolean.TRUE.equals(tx.execute(s -> fichas.findByPacienteId(pacienteId).isPresent()));
	}
}
