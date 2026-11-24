package ar.global.odonto.agenda;

import ar.global.odonto.agenda.turno.IntervaloTurno;
import ar.global.odonto.agenda.turno.TransicionesTurno;
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
 * Turno (C-02; comportamiento de C-07). Estado, horario, sillon, profesional y marca de sobreturno solo cambian por
 * {@link #cambiarEstado} y {@link #reprogramar}: las reglas de agenda (solapamiento, horario, bloqueos) las valida
 * {@code TurnoService} antes de llamarlos; aca solo se protege la maquina de estados (RN-AG-05) como ultima defensa.
 * {@code version} = bloqueo optimista. Instantes en UTC.
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

	/** Alta de C-07: nace {@code PROGRAMADO}. */
	public Turno(Paciente paciente, Profesional profesional, Sillon sillon, Prestacion prestacion,
			IntervaloTurno intervalo, boolean sobreturno, String notas) {
		this(paciente, profesional, sillon, prestacion, intervalo.inicio(), intervalo.fin());
		this.esSobreturno = sobreturno;
		this.notas = notas;
	}

	/**
	 * Aplica una transicion de RN-AG-05. El motivo solo se guarda al cancelar.
	 *
	 * @throws IllegalStateException si la transicion no es valida (el servicio la rechaza antes con 409)
	 */
	public void cambiarEstado(EstadoTurno nuevo, String motivoCancelacion) {
		if (!TransicionesTurno.permitida(estado, nuevo)) {
			throw new IllegalStateException("Transicion de turno invalida");
		}
		this.estado = nuevo;
		if (nuevo == EstadoTurno.CANCELADO) {
			this.motivoCancelacion = motivoCancelacion;
		}
	}

	/**
	 * Mueve el turno (RN-AG-06). Conserva paciente, prestacion y estado.
	 *
	 * @throws IllegalStateException si el turno esta en un estado final
	 */
	public void reprogramar(Sillon nuevoSillon, Profesional nuevoProfesional, IntervaloTurno intervalo,
			boolean sobreturno) {
		if (!TransicionesTurno.reprogramable(estado)) {
			throw new IllegalStateException("Turno no reprogramable");
		}
		this.sillon = nuevoSillon;
		this.profesional = nuevoProfesional;
		this.inicio = intervalo.inicio();
		this.fin = intervalo.fin();
		this.esSobreturno = sobreturno;
	}

	public IntervaloTurno getIntervalo() {
		return new IntervaloTurno(inicio, fin);
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

	public Instant getFin() {
		return fin;
	}

	public EstadoTurno getEstado() {
		return estado;
	}

	public boolean isEsSobreturno() {
		return esSobreturno;
	}

	public String getMotivoCancelacion() {
		return motivoCancelacion;
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
