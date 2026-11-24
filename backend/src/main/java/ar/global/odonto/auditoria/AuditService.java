package ar.global.odonto.auditoria;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * ZONA DE RIESGO (regla 12). Unico escritor de {@code audit_log} (RN-DS-02, design D2/D3).
 *
 * <p>
 * Contrato para los consumidores (C-07, C-08, C-15):
 * <ul>
 * <li>Exige una transaccion activa ({@code MANDATORY}): sin ella lanza {@code IllegalTransactionStateException}
 * y la operacion falla, en lugar de auditar "aparte". El registro se confirma o revierte junto con la operacion
 * (fail-closed).</li>
 * <li>El consultorio sale del {@code TenantContext} (via {@code @TenantId}); usuario e IP de
 * {@link ContextoAuditoria}. Ambos son {@code null} fuera de una request (jobs).</li>
 * <li>El detalle es un {@link DetalleAuditoria} (sin PII). {@code entidad} no puede ser vacia ni superar 100
 * caracteres.</li>
 * <li>Cualquier excepcion propaga: no se traga ningun error de auditoria.</li>
 * <li>Usar {@code registrar} directamente cuando el detalle es dinamico o el id no es expresable en
 * {@link Audited}; en el resto, {@code @Audited}.</li>
 * </ul>
 */
@Service
public class AuditService {

	static final int ENTIDAD_MAX = 100;

	private final AuditLogRepository repositorio;
	private final ContextoAuditoria contexto;

	public AuditService(AuditLogRepository repositorio, ContextoAuditoria contexto) {
		this.repositorio = repositorio;
		this.contexto = contexto;
	}

	/** Registra con el usuario y la IP de la request en curso. */
	@Transactional(propagation = Propagation.MANDATORY)
	public void registrar(AccionAuditoria accion, String entidad, Long entidadId, DetalleAuditoria detalle) {
		guardar(contexto.usuarioId(), contexto.ip(), accion, entidad, entidadId, detalle);
	}

	/** Registra con usuario e IP explicitos (LOGIN: aun no hay autenticacion en el contexto). */
	@Transactional(propagation = Propagation.MANDATORY)
	public void registrarComo(Long usuarioId, String ip, AccionAuditoria accion, String entidad, Long entidadId,
			DetalleAuditoria detalle) {
		guardar(usuarioId, recortar(ip), accion, entidad, entidadId, detalle);
	}

	private void guardar(Long usuarioId, String ip, AccionAuditoria accion, String entidad, Long entidadId,
			DetalleAuditoria detalle) {
		if (accion == null || entidad == null || entidad.isBlank() || entidad.length() > ENTIDAD_MAX) {
			throw new IllegalArgumentException("Accion o entidad de auditoria invalida");
		}
		DetalleAuditoria d = detalle == null ? DetalleAuditoria.vacio() : detalle;
		repositorio.save(new AuditLog(usuarioId, accion, entidad, entidadId, d.json(), ip));
	}

	private static String recortar(String ip) {
		return ip != null && ip.length() > ContextoAuditoria.IP_MAX ? ip.substring(0, ContextoAuditoria.IP_MAX) : ip;
	}
}
