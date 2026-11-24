package ar.global.odonto.auditoria.consulta;

import ar.global.odonto.auditoria.AccionAuditoria;
import ar.global.odonto.auditoria.AuditLogRepository;
import ar.global.odonto.common.web.Pagina;
import ar.global.odonto.common.web.ValidacionException;
import ar.global.odonto.security.Permisos;
import java.time.Instant;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Consulta del log de auditoria (design D6). Solo {@code ADMIN}/{@code PROFESIONAL}; el tenant lo aplica
 * {@code @TenantId}. La lectura del propio log NO se audita (no usa {@code @Audited}), por eso puede ser
 * {@code readOnly}.
 */
@Service
public class AuditoriaConsultaService {

	static final int TAMANIO_POR_DEFECTO = 20;
	static final int TAMANIO_MAXIMO = 100;
	static final int ENTIDAD_MAX = 100;

	private final AuditLogRepository repositorio;
	private final AuditLogMapper mapper;

	public AuditoriaConsultaService(AuditLogRepository repositorio, AuditLogMapper mapper) {
		this.repositorio = repositorio;
		this.mapper = mapper;
	}

	@PreAuthorize(Permisos.GESTION)
	@Transactional(readOnly = true)
	public Pagina<AuditLogResponse> buscar(Instant desde, Instant hasta, AccionAuditoria accion, String entidad,
			Long entidadId, Long usuarioId, int page, int size) {
		if (desde != null && hasta != null && desde.isAfter(hasta)) {
			throw new ValidacionException("desde", "debe ser anterior a hasta");
		}
		String entidadFiltro = entidad == null || entidad.isBlank() ? null : entidad.strip();
		if (entidadFiltro != null && entidadFiltro.length() > ENTIDAD_MAX) {
			throw new ValidacionException("entidad", "formato inválido");
		}
		int tamanio = size < 1 ? TAMANIO_POR_DEFECTO : Math.min(size, TAMANIO_MAXIMO);
		PageRequest pagina = PageRequest.of(Math.max(page, 0), tamanio);
		return Pagina.de(repositorio.buscar(desde, hasta, accion, entidadFiltro, entidadId, usuarioId, pagina)
				.map(mapper::aResponse));
	}
}
