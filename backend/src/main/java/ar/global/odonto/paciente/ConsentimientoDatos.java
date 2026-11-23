package ar.global.odonto.paciente;

import ar.global.odonto.common.persistence.TenantEntity;
import ar.global.odonto.usuario.Usuario;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/** Consentimiento de tratamiento de datos aceptado por un paciente, sobre una version del texto. */
@Entity
@Table(name = "consentimiento_datos")
public class ConsentimientoDatos extends TenantEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "paciente_id", nullable = false)
	private Paciente paciente;

	@Column(name = "version_texto", nullable = false, length = 20)
	private String versionTexto;

	@Column(name = "aceptado_en", nullable = false)
	private Instant aceptadoEn;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "registrado_por_usuario_id", nullable = false)
	private Usuario registradoPor;

	protected ConsentimientoDatos() {
	}

	public ConsentimientoDatos(Paciente paciente, String versionTexto, Instant aceptadoEn, Usuario registradoPor) {
		this.paciente = paciente;
		this.versionTexto = versionTexto;
		this.aceptadoEn = aceptadoEn;
		this.registradoPor = registradoPor;
	}

	public Paciente getPaciente() {
		return paciente;
	}

	public String getVersionTexto() {
		return versionTexto;
	}

	public Instant getAceptadoEn() {
		return aceptadoEn;
	}

	public Usuario getRegistradoPor() {
		return registradoPor;
	}
}
