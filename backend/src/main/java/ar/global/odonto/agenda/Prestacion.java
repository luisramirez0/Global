package ar.global.odonto.agenda;

import ar.global.odonto.common.persistence.TenantEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Prestacion ofrecida (consulta, limpieza...) con su duracion en minutos. */
@Entity
@Table(name = "prestacion")
public class Prestacion extends TenantEntity {

	@Column(nullable = false, length = 150)
	private String nombre;

	@Column(name = "duracion_minutos", nullable = false)
	private int duracionMinutos;

	@Column(nullable = false)
	private boolean activo = true;

	protected Prestacion() {
	}

	public Prestacion(String nombre, int duracionMinutos) {
		this.nombre = nombre;
		this.duracionMinutos = duracionMinutos;
	}

	public String getNombre() {
		return nombre;
	}

	public void setNombre(String nombre) {
		this.nombre = nombre;
	}

	public int getDuracionMinutos() {
		return duracionMinutos;
	}

	public void setDuracionMinutos(int duracionMinutos) {
		this.duracionMinutos = duracionMinutos;
	}

	public boolean isActivo() {
		return activo;
	}

	public void setActivo(boolean activo) {
		this.activo = activo;
	}
}
