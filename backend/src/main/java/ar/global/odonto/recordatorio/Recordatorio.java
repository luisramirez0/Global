package ar.global.odonto.recordatorio;

import ar.global.odonto.agenda.Turno;
import ar.global.odonto.common.persistence.TenantEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/** Recordatorio de un turno por WhatsApp (enlace wa.me) o email. */
@Entity
@Table(name = "recordatorio")
public class Recordatorio extends TenantEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "turno_id", nullable = false)
	private Turno turno;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private CanalRecordatorio canal;

	@Column(name = "generado_en", nullable = false)
	private Instant generadoEn;

	@Column(name = "enviado_en")
	private Instant enviadoEn;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private EstadoRecordatorio estado;

	@Column(name = "detalle_error", length = 500)
	private String detalleError;

	protected Recordatorio() {
	}

	public Recordatorio(Turno turno, CanalRecordatorio canal, Instant generadoEn, EstadoRecordatorio estado) {
		this.turno = turno;
		this.canal = canal;
		this.generadoEn = generadoEn;
		this.estado = estado;
	}

	public Turno getTurno() {
		return turno;
	}

	public CanalRecordatorio getCanal() {
		return canal;
	}

	public Instant getGeneradoEn() {
		return generadoEn;
	}

	public Instant getEnviadoEn() {
		return enviadoEn;
	}

	public void setEnviadoEn(Instant enviadoEn) {
		this.enviadoEn = enviadoEn;
	}

	public EstadoRecordatorio getEstado() {
		return estado;
	}

	public void setEstado(EstadoRecordatorio estado) {
		this.estado = estado;
	}

	public String getDetalleError() {
		return detalleError;
	}

	public void setDetalleError(String detalleError) {
		this.detalleError = detalleError;
	}
}
