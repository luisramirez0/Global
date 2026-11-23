package ar.global.odonto.agenda;

import ar.global.odonto.common.persistence.TenantEntity;
import ar.global.odonto.paciente.Paciente;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;

/**
 * Turno. Solo estructura e indices: la validacion de solapamiento y la maquina de estados son de C-07.
 * {@code version} = bloqueo optimista para edicion concurrente. Instantes en UTC.
 */
@Entity
@Table(name = "turno")
public class Turno extends TenantEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "paciente_id", nullable = false)
	private Paciente paciente;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "profesional_id", nullable = false)
	private Profesional profesional;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "sillon_id", nullable = false)
	private Sillon sillon;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "prestacion_id", nullable = false)
	private Prestacion prestacion;

	@Column(nullable = false)
	private Instant inicio;

	@Column(nullable = false)
	private Instant fin;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private EstadoTurno estado = EstadoTurno.PROGRAMADO;

	@Column(name = "es_sobreturno", nullable = false)
	private boolean esSobreturno;

	@Column(name = "motivo_cancelacion", length = 255)
	private String motivoCancelacion;

	@Column(columnDefinition = "TEXT")
	private String notas;

	@Version
	private long version;

	protected Turno() {
	}

	public Turno(Paciente paciente, Profesional profesional, Sillon sillon, Prestacion prestacion, Instant inicio,
			Instant fin) {
		this.paciente = paciente;
		this.profesional = profesional;
		this.sillon = sillon;
		this.prestacion = prestacion;
		this.inicio = inicio;
		this.fin = fin;
	}

	public Paciente getPaciente() {
		return paciente;
	}

	public Profesional getProfesional() {
		return profesional;
	}

	public Sillon getSillon() {
		return sillon;
	}

	public Prestacion getPrestacion() {
		return prestacion;
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

	public EstadoTurno getEstado() {
		return estado;
	}

	public void setEstado(EstadoTurno estado) {
		this.estado = estado;
	}

	public boolean isEsSobreturno() {
		return esSobreturno;
	}

	public void setEsSobreturno(boolean esSobreturno) {
		this.esSobreturno = esSobreturno;
	}

	public String getMotivoCancelacion() {
		return motivoCancelacion;
	}

	public void setMotivoCancelacion(String motivoCancelacion) {
		this.motivoCancelacion = motivoCancelacion;
	}

	public String getNotas() {
		return notas;
	}

	public void setNotas(String notas) {
		this.notas = notas;
	}

	public long getVersion() {
		return version;
	}
}
