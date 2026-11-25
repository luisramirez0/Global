package ar.global.odonto.paciente.export;

import java.time.Clock;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.auditoria.AuditService;
import ar.global.odonto.auditoria.AuditoriaFallidaException;
import ar.global.odonto.auditoria.DetalleAuditoria;
import ar.global.odonto.common.tenant.TenantContext;
import ar.global.odonto.common.web.RecursoNoEncontradoException;
import ar.global.odonto.paciente.ConsentimientoDatosRepository;
import ar.global.odonto.paciente.FichaClinicaRepository;
import ar.global.odonto.paciente.Paciente;
import ar.global.odonto.paciente.PacienteRepository;
import ar.global.odonto.paciente.export.PacienteExportResponse.Consentimiento;
import ar.global.odonto.paciente.export.PacienteExportResponse.Ficha;
import ar.global.odonto.paciente.export.PacienteExportResponse.Nota;
import ar.global.odonto.paciente.export.PacienteExportResponse.TurnoExportado;
import ar.global.odonto.security.Permisos;

/**
 * ZONA DE RIESGO (regla 12). Export de los datos de un paciente (design D1-D5). Solo ADMIN/PROFESIONAL; admite
 * pacientes dados de baja y sin consentimiento (RN-DS-06). Arma el paquete y registra {@code EXPORT} en una UNICA
 * transaccion de lectura-escritura propia: sin {@code @Transactional} ni {@code @Audited} (detalle dinamico, regla
 * 6 de C-06) y nunca {@code readOnly} (regla 5, MySQL). Si la auditoria falla, {@code 500} generico y no sale
 * ningun dato (D4). Logs solo con ids (regla 5).
 */
@Service
public class PacienteExportService {

	static final String ENTIDAD = "Paciente";

	private static final Logger log = LoggerFactory.getLogger(PacienteExportService.class);

	private final PacienteRepository pacientes;
	private final FichaClinicaRepository fichas;
	private final ConsentimientoDatosRepository consentimientos;
	private final PacienteExportRepository consultas;
	private final AuditService auditoria;
	private final TransactionTemplate tx;
	private final Clock clock;

	public PacienteExportService(PacienteRepository pacientes, FichaClinicaRepository fichas,
			ConsentimientoDatosRepository consentimientos, PacienteExportRepository consultas, AuditService auditoria,
			PlatformTransactionManager transactionManager, Clock clock) {
		this.pacientes = pacientes;
		this.fichas = fichas;
		this.consentimientos = consentimientos;
		this.consultas = consultas;
		this.auditoria = auditoria;
		this.clock = clock;
		// Explicito: lectura-escritura y REQUIRED, para que el INSERT de auditoria no falle en MySQL por una
		// conexion de solo lectura.
		this.tx = new TransactionTemplate(transactionManager);
		this.tx.setReadOnly(false);
		this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);
	}

	@PreAuthorize(Permisos.GESTION)
	public PacienteExportResponse exportar(Long pacienteId) {
		PacienteExportResponse paquete = tx.execute(s -> {
			Paciente paciente = pacientes.findById(pacienteId).orElseThrow(RecursoNoEncontradoException::new);
			List<Consentimiento> cons = consentimientos.findByPacienteIdOrderByAceptadoEnDescIdDesc(pacienteId)
					.stream().map(PacienteExportMapper::consentimiento).toList();
			Ficha ficha = fichas.findByPacienteId(pacienteId).map(PacienteExportMapper::ficha).orElse(null);
			List<Nota> notas = consultas.notasDe(pacienteId).stream().map(PacienteExportMapper::nota).toList();
			List<TurnoExportado> turnos = consultas.turnosDe(pacienteId).stream().map(PacienteExportMapper::turno)
					.toList();
			auditar(pacienteId, DetalleAuditoria.vacio().con("consentimientos", cons.size())
					.con("ficha", ficha != null).con("notas", notas.size()).con("turnos", turnos.size()));
			return new PacienteExportResponse(clock.instant(), PacienteExportMapper.paciente(paciente), cons, ficha,
					notas, turnos);
		});
		log.info("Exportacion de datos de paciente pacienteId={}", pacienteId);
		return paquete;
	}

	/** Mismo criterio que {@code TurnoService}: fallo ruidoso solo con ids y tipo, y 500 generico. */
	private void auditar(Long pacienteId, DetalleAuditoria detalle) {
		try {
			auditoria.registrar(AccionAuditoria.EXPORT, ENTIDAD, pacienteId, detalle);
		}
		catch (RuntimeException e) {
			log.error("Fallo de auditoria accion={} entidad={} entidadId={} consultorioId={} causa={}",
					AccionAuditoria.EXPORT, ENTIDAD, pacienteId, TenantContext.get().orElse(null),
					e.getClass().getSimpleName());
			throw new AuditoriaFallidaException();
		}
	}
}
