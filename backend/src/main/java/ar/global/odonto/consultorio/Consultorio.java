package ar.global.odonto.consultorio;

import ar.global.odonto.common.persistence.AuditableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Tenant del sistema. No es {@code TenantEntity}: su id es el tenant (design D1). */
@Entity
@Table(name = "consultorio")
public class Consultorio extends AuditableEntity {

	public static final String ZONA_HORARIA_DEFAULT = "America/Argentina/Buenos_Aires";

	@Column(nullable = false, length = 150)
	private String nombre;

	@Column(length = 13)
	private String cuit;

	@Column(length = 30)
	private String telefono;

	@Column(length = 254)
	private String email;

	@Column(length = 255)
	private String direccion;

	@Column(name = "zona_horaria", nullable = false, length = 60)
	private String zonaHoraria = ZONA_HORARIA_DEFAULT;

	@Column(nullable = false)
	private boolean activo = true;

	protected Consultorio() {
	}

	public Consultorio(String nombre) {
		this.nombre = nombre;
	}

	public String getNombre() {
		return nombre;
	}

	public void setNombre(String nombre) {
		this.nombre = nombre;
	}

	public String getCuit() {
		return cuit;
	}

	public void setCuit(String cuit) {
		this.cuit = cuit;
	}

	public String getTelefono() {
		return telefono;
	}

	public void setTelefono(String telefono) {
		this.telefono = telefono;
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

	public String getDireccion() {
		return direccion;
	}

	public void setDireccion(String direccion) {
		this.direccion = direccion;
	}

	public String getZonaHoraria() {
		return zonaHoraria;
	}

	public void setZonaHoraria(String zonaHoraria) {
		this.zonaHoraria = zonaHoraria;
	}

	public boolean isActivo() {
		return activo;
	}

	public void setActivo(boolean activo) {
		this.activo = activo;
	}
}
