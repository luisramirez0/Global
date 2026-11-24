package ar.global.odonto.paciente.ficha;

import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.auditoria.AuditService;
import ar.global.odonto.auditoria.ContextoAuditoria;
import ar.global.odonto.auditoria.DetalleAuditoria;
import ar.global.odonto.common.web.RecursoNoEncontradoException;
import ar.global.odonto.common.web.ValidacionException;
import ar.global.odonto.paciente.ConsentimientoDatos;
import ar.global.odonto.paciente.ConsentimientoDatosRepository;
import ar.global.odonto.paciente.ConsentimientoTexto;
import ar.global.odonto.paciente.ConsentimientoTextoRepository;
import ar.global.odonto.paciente.Paciente;
import ar.global.odonto.security.Permisos;
import ar.global.odonto.usuario.UsuarioRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * ZONA DE RIESGO (regla 12). Consentimiento de tratamiento de datos (RN-DS-03, design D3, D8, D10). Solo
 * ADMIN/PROFESIONAL (PA-07). El alta se audita como {@code CREATE ConsentimientoDatos} con
 * {@code entidadId = pacienteId}; las lecturas no se auditan (no devuelven datos de salud, checkpoint 2), por eso
 * pueden ser {@code readOnly}.
 */
@Service
public class ConsentimientoService {

	static final String ENTIDAD = "ConsentimientoDatos";

	private static final Logger log = LoggerFactory.getLogger(ConsentimientoService.class);

	private final PacienteClinico clinico;
	private final ConsentimientoDatosRepository consentimientos;
	private final ConsentimientoTextoRepository textos;
	private final UsuarioRepository usuarios;
	private final ContextoAuditoria contexto;
	private final AuditService auditoria;
	private final Clock clock;

	public ConsentimientoService(PacienteClinico clinico, ConsentimientoDatosRepository consentimientos,
			ConsentimientoTextoRepository textos, UsuarioRepository usuarios, ContextoAuditoria contexto,
			AuditService auditoria, Clock clock) {
		this.clinico = clinico;
		this.consentimientos = consentimientos;
		this.textos = textos;
		this.usuarios = usuarios;
		this.contexto = contexto;
		this.auditoria = auditoria;
		this.clock = clock;
	}

	/**
	 * Registra la aceptacion de una version del texto que exista y ya este en vigencia; una version inexistente o
	 * de vigencia futura es {@code 400} sin eco (design D10).
	 */
	@PreAuthorize(Permisos.GESTION)
	@Transactional
	public ConsentimientoResponse registrar(Long pacienteId, ConsentimientoRequest req) {
		Paciente paciente = clinico.paraConsentir(pacienteId);
		Instant ahora = clock.instant();
		ConsentimientoTexto texto = textos.findById(req.versionTexto().trim())
				.filter(t -> !t.getVigenteDesde().isAfter(ahora))
				.orElseThrow(() -> new ValidacionException("versionTexto", "versión inexistente o no vigente"));
		ConsentimientoDatos guardado = consentimientos.save(new ConsentimientoDatos(paciente, texto.getVersion(),
				ahora, usuarios.getReferenceById(contexto.usuarioId())));
		// La version sale de la fila del catalogo ya validada, no del texto del pedido (contrato de C-06).
		auditoria.registrar(AccionAuditoria.CREATE, ENTIDAD, pacienteId, DetalleAuditoria.vacio()
				.con("consentimientoId", guardado.getId()).conCodigo("versionTexto", texto.getVersion()));
		log.info("Consentimiento registrado id={} pacienteId={}", guardado.getId(), pacienteId);
		return ConsentimientoResponse.de(guardado);
	}

	@PreAuthorize(Permisos.GESTION)
	@Transactional(readOnly = true)
	public List<ConsentimientoResponse> listar(Long pacienteId) {
		clinico.buscar(pacienteId);
		return consentimientos.findByPacienteIdOrderByAceptadoEnDescIdDesc(pacienteId).stream()
				.map(ConsentimientoResponse::de).toList();
	}

	@PreAuthorize(Permisos.GESTION)
	@Transactional(readOnly = true)
	public TextoConsentimientoResponse textoVigente() {
		return textos.findFirstByVigenteDesdeLessThanEqualOrderByVigenteDesdeDescVersionDesc(clock.instant())
				.map(TextoConsentimientoResponse::de).orElseThrow(RecursoNoEncontradoException::new);
	}
}
