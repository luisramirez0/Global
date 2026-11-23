package ar.global.odonto.paciente;

import ar.global.odonto.common.persistence.TenantEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/**
 * Anamnesis basica (1:1 con paciente). Dato de salud sensible (RN-DS-01): su {@code toString} NO imprime
 * contenido clinico. {@code version} = bloqueo optimista de la edicion concurrente.
 */
@Entity
@Table(name = "ficha_clinica")
public class FichaClinica extends TenantEntity {

	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "paciente_id", nullable = false)
	private Paciente paciente;

	@Column(columnDefinition = "TEXT")
	private String alergias;

	@Column(name = "medicacion_actual", columnDefinition = "TEXT")
	private String medicacionActual;

	@Column(name = "antecedentes_medicos", columnDefinition = "TEXT")
	private String antecedentesMedicos;

	@Column(name = "enfermedades_relevantes", columnDefinition = "TEXT")
	private String enfermedadesRelevantes;

	private Boolean embarazo;

	@Column(name = "motivo_consulta", columnDefinition = "TEXT")
	private String motivoConsulta;

	@Column(columnDefinition = "TEXT")
	private String observaciones;

	@Version
	private long version;

	protected FichaClinica() {
	}

	public FichaClinica(Paciente paciente) {
		this.paciente = paciente;
	}

	public Paciente getPaciente() {
		return paciente;
	}

	public String getAlergias() {
		return alergias;
	}

	public void setAlergias(String alergias) {
		this.alergias = alergias;
	}

	public String getMedicacionActual() {
		return medicacionActual;
	}

	public void setMedicacionActual(String medicacionActual) {
		this.medicacionActual = medicacionActual;
	}

	public String getAntecedentesMedicos() {
		return antecedentesMedicos;
	}

	public void setAntecedentesMedicos(String antecedentesMedicos) {
		this.antecedentesMedicos = antecedentesMedicos;
	}

	public String getEnfermedadesRelevantes() {
		return enfermedadesRelevantes;
	}

	public void setEnfermedadesRelevantes(String enfermedadesRelevantes) {
		this.enfermedadesRelevantes = enfermedadesRelevantes;
	}

	public Boolean getEmbarazo() {
		return embarazo;
	}

	public void setEmbarazo(Boolean embarazo) {
		this.embarazo = embarazo;
	}

	public String getMotivoConsulta() {
		return motivoConsulta;
	}

	public void setMotivoConsulta(String motivoConsulta) {
		this.motivoConsulta = motivoConsulta;
	}

	public String getObservaciones() {
		return observaciones;
	}

	public void setObservaciones(String observaciones) {
		this.observaciones = observaciones;
	}

	public long getVersion() {
		return version;
	}
}
