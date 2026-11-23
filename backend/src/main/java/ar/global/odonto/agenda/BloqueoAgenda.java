package ar.global.odonto.agenda;

import ar.global.odonto.common.persistence.TenantEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/** Bloqueo de agenda de un profesional y/o sillon (instantes en UTC). */
@Entity
@Table(name = "bloqueo_agenda")
public class BloqueoAgenda extends TenantEntity {

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "profesional_id")
	private Profesional profesional;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "sillon_id")
	private Sillon sillon;

	@Column(nullable = false)
	private Instant inicio;

	@Column(nullable = false)
	private Instant fin;

	@Column(length = 255)
	private String motivo;

	protected BloqueoAgenda() {
	}

	public BloqueoAgenda(Instant inicio, Instant fin) {
		this.inicio = inicio;
		this.fin = fin;
	}

	public Profesional getProfesional() {
		return profesional;
	}

	public void setProfesional(Profesional profesional) {
		this.profesional = profesional;
	}

	public Sillon getSillon() {
		return sillon;
	}

	public void setSillon(Sillon sillon) {
		this.sillon = sillon;
	}

	public Instant getInicio() {
		return inicio;
	}

	public void setInicio(Instant inicio) {
		this.inicio = inicio;
	}

	public Instant getFin() {
		return fin;
	}

	public void setFin(Instant fin) {
		this.fin = fin;
	}

	public String getMotivo() {
		return motivo;
	}

	public void setMotivo(String motivo) {
		this.motivo = motivo;
	}
}
