package ar.global.odonto.paciente;

import ar.global.odonto.common.persistence.TenantEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDate;

/**
 * Paciente del consultorio. DNI unico por consultorio (RN-PA); baja logica con {@code activo}.
 * Contiene datos personales: no sobreescribir {@code toString} (regla 5).
 */
@Entity
@Table(name = "paciente")
public class Paciente extends TenantEntity {

	@Column(nullable = false, length = 100)
	private String nombre;

	@Column(nullable = false, length = 100)
	private String apellido;

	@Column(nullable = false, length = 20)
	private String dni;

	@Column(name = "fecha_nacimiento")
	private LocalDate fechaNacimiento;

	@Column(length = 20)
	private String sexo;

	@Column(length = 30)
	private String telefono;

	@Column(length = 254)
	private String email;

	@Column(length = 255)
	private String direccion;

	@Column(name = "obra_social_texto", length = 150)
	private String obraSocialTexto;

	@Column(nullable = false)
	private boolean activo = true;

	protected Paciente() {
	}

	public Paciente(String nombre, String apellido, String dni) {
		this.nombre = nombre;
		this.apellido = apellido;
		this.dni = dni;
	}

	public String getNombre() {
		return nombre;
	}

	public void setNombre(String nombre) {
		this.nombre = nombre;
	}

	public String getApellido() {
		return apellido;
	}

	public void setApellido(String apellido) {
		this.apellido = apellido;
	}

	public String getDni() {
		return dni;
	}

	public void setDni(String dni) {
		this.dni = dni;
	}

	public LocalDate getFechaNacimiento() {
		return fechaNacimiento;
	}

	public void setFechaNacimiento(LocalDate fechaNacimiento) {
		this.fechaNacimiento = fechaNacimiento;
	}

	public String getSexo() {
		return sexo;
	}

	public void setSexo(String sexo) {
		this.sexo = sexo;
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

	public String getObraSocialTexto() {
		return obraSocialTexto;
	}

	public void setObraSocialTexto(String obraSocialTexto) {
		this.obraSocialTexto = obraSocialTexto;
	}

	public boolean isActivo() {
		return activo;
	}

	public void setActivo(boolean activo) {
		this.activo = activo;
	}
}
