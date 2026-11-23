package ar.global.odonto.agenda;

import ar.global.odonto.common.persistence.TenantEntity;
import ar.global.odonto.usuario.Usuario;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Profesional que atiende. La FK compuesta {@code (consultorio_id, usuario_id)} la garantiza la base
 * (design D2); JPA solo mapea la columna {@code usuario_id}.
 */
@Entity
@Table(name = "profesional")
public class Profesional extends TenantEntity {

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "usuario_id")
	private Usuario usuario;

	@Column(nullable = false, length = 100)
	private String nombre;

	@Column(nullable = false, length = 100)
	private String apellido;

	@Column(length = 50)
	private String matricula;

	@Column(name = "color_agenda", length = 7)
	private String colorAgenda;

	@Column(nullable = false)
	private boolean activo = true;

	protected Profesional() {
	}

	public Profesional(String nombre, String apellido) {
		this.nombre = nombre;
		this.apellido = apellido;
	}

	public Usuario getUsuario() {
		return usuario;
	}

	public void setUsuario(Usuario usuario) {
		this.usuario = usuario;
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

	public String getMatricula() {
		return matricula;
	}

	public void setMatricula(String matricula) {
		this.matricula = matricula;
	}

	public String getColorAgenda() {
		return colorAgenda;
	}

	public void setColorAgenda(String colorAgenda) {
		this.colorAgenda = colorAgenda;
	}

	public boolean isActivo() {
		return activo;
	}

	public void setActivo(boolean activo) {
		this.activo = activo;
	}
}
