package ar.global.odonto.agenda;

import ar.global.odonto.common.persistence.TenantEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Sillon (recurso fisico) del consultorio. */
@Entity
@Table(name = "sillon")
public class Sillon extends TenantEntity {

	@Column(nullable = false, length = 100)
	private String nombre;

	@Column(nullable = false)
	private boolean activo = true;

	protected Sillon() {
	}

	public Sillon(String nombre) {
		this.nombre = nombre;
	}

	public String getNombre() {
		return nombre;
	}

	public void setNombre(String nombre) {
		this.nombre = nombre;
	}

	public boolean isActivo() {
		return activo;
	}

	public void setActivo(boolean activo) {
		this.activo = activo;
	}
}
