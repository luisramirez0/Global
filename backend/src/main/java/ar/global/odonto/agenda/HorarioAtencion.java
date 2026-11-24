package ar.global.odonto.agenda;

import ar.global.odonto.common.persistence.TenantEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalTime;

/** Franja de atencion semanal de un profesional (hora local del consultorio, sin zona). */
@Entity
@Table(name = "horario_atencion")
public class HorarioAtencion extends TenantEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "profesional_id", nullable = false)
	private Profesional profesional;

	/** 1 = lunes ... 7 = domingo. */
	@Column(name = "dia_semana", nullable = false)
	private int diaSemana;

	@Column(name = "hora_desde", nullable = false)
	private LocalTime horaDesde;

	@Column(name = "hora_hasta", nullable = false)
	private LocalTime horaHasta;

	protected HorarioAtencion() {
	}

	public HorarioAtencion(Profesional profesional, int diaSemana, LocalTime horaDesde, LocalTime horaHasta) {
		this.profesional = profesional;
		this.diaSemana = diaSemana;
		this.horaDesde = horaDesde;
		this.horaHasta = horaHasta;
	}

	public Profesional getProfesional() {
		return profesional;
	}

	public void setProfesional(Profesional profesional) {
		this.profesional = profesional;
	}

	public int getDiaSemana() {
		return diaSemana;
	}

	public void setDiaSemana(int diaSemana) {
		this.diaSemana = diaSemana;
	}

	public LocalTime getHoraDesde() {
		return horaDesde;
	}

	public void setHoraDesde(LocalTime horaDesde) {
		this.horaDesde = horaDesde;
	}

	public LocalTime getHoraHasta() {
		return horaHasta;
	}

	public void setHoraHasta(LocalTime horaHasta) {
		this.horaHasta = horaHasta;
	}
}
