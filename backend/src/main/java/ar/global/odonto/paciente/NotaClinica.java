package ar.global.odonto.paciente;

import ar.global.odonto.agenda.Profesional;
import ar.global.odonto.agenda.Turno;
import ar.global.odonto.common.persistence.TenantEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/** Nota de evolucion clinica. Dato de salud sensible: su {@code toString} NO imprime el texto. */
@Entity
@Table(name = "nota_clinica")
public class NotaClinica extends TenantEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "paciente_id", nullable = false)
	private Paciente paciente;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "profesional_id", nullable = false)
	private Profesional profesional;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "turno_id")
	private Turno turno;

	@Column(nullable = false)
	private Instant fecha;

	@Column(nullable = false, columnDefinition = "TEXT")
	private String texto;

	protected NotaClinica() {
	}

	public NotaClinica(Paciente paciente, Profesional profesional, Instant fecha, String texto) {
		this.paciente = paciente;
		this.profesional = profesional;
		this.fecha = fecha;
		this.texto = texto;
	}

	public Paciente getPaciente() {
		return paciente;
	}

	public Profesional getProfesional() {
		return profesional;
	}

	public Turno getTurno() {
		return turno;
	}

	public void setTurno(Turno turno) {
		this.turno = turno;
	}

	public Instant getFecha() {
		return fecha;
	}

	public String getTexto() {
		return texto;
	}

	public void setTexto(String texto) {
		this.texto = texto;
	}
}
