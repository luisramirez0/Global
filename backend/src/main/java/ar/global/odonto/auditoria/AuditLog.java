package ar.global.odonto.auditoria;

import ar.global.odonto.common.persistence.AbstractEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.TenantId;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * Registro de auditoria insert-only (RN-DS-02, design D3).
 *
 * <ul>
 * <li>{@code @Immutable}: Hibernate ignora modificaciones de una entidad cargada y, con
 * {@code immutable_entity_update_query_handling_mode=exception}, rechaza UPDATE/DELETE HQL masivos.</li>
 * <li>No tiene {@code updated_at} (lo inmutable no se actualiza) ni extiende {@code TenantEntity}: excepcion
 * deliberada a "toda tabla con updated_at". {@code consultorio_id} es NOT NULL (decision Q3).</li>
 * <li>{@code detalle} no admite PII ni datos de salud (regla 5): solo identificadores o metadatos no
 * personales; lo hace cumplir C-06.</li>
 * <li>PENDIENTE (C-16): guard de base de datos por permisos de MySQL: el usuario de la aplicacion debe tener
 * {@code GRANT SELECT, INSERT} (sin {@code UPDATE}/{@code DELETE}) sobre {@code audit_log}, lo que requiere
 * separar el usuario de migraciones del de la aplicacion. Los triggers no son portables a H2.</li>
 * </ul>
 */
@Entity
@Immutable
@Table(name = "audit_log")
@EntityListeners(AuditingEntityListener.class)
public class AuditLog extends AbstractEntity {

	@TenantId
	@Column(name = "consultorio_id", nullable = false, updatable = false)
	private Long consultorioId;

	@Column(name = "usuario_id")
	private Long usuarioId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private AccionAuditoria accion;

	@Column(nullable = false, length = 100)
	private String entidad;

	@Column(name = "entidad_id")
	private Long entidadId;

	@Column(columnDefinition = "TEXT")
	private String detalle;

	@Column(length = 45)
	private String ip;

	@CreatedDate
	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	protected AuditLog() {
	}

	public AuditLog(Long usuarioId, AccionAuditoria accion, String entidad, Long entidadId, String detalle,
			String ip) {
		this.usuarioId = usuarioId;
		this.accion = accion;
		this.entidad = entidad;
		this.entidadId = entidadId;
		this.detalle = detalle;
		this.ip = ip;
	}

	public Long getConsultorioId() {
		return consultorioId;
	}

	public Long getUsuarioId() {
		return usuarioId;
	}

	public AccionAuditoria getAccion() {
		return accion;
	}

	public String getEntidad() {
		return entidad;
	}

	public Long getEntidadId() {
		return entidadId;
	}

	public String getDetalle() {
		return detalle;
	}

	public String getIp() {
		return ip;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
