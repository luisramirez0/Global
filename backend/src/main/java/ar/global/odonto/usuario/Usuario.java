package ar.global.odonto.usuario;

import ar.global.odonto.common.persistence.TenantEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Locale;

/** Usuario del sistema. El email es único global y se normaliza a minúsculas (design D11). */
@Entity
@Table(name = "usuario")
public class Usuario extends TenantEntity {

	@Column(nullable = false, length = 254)
	private String email;

	@Column(name = "password_hash", nullable = false, length = 100)
	private String passwordHash;

	@Column(nullable = false, length = 100)
	private String nombre;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private Rol rol;

	@Column(nullable = false)
	private boolean activo = true;

	@Column(name = "ultimo_login")
	private Instant ultimoLogin;

	protected Usuario() {
	}

	public Usuario(String email, String passwordHash, String nombre, Rol rol) {
		this.email = normalizeEmail(email);
		this.passwordHash = passwordHash;
		this.nombre = nombre;
		this.rol = rol;
	}

	public static String normalizeEmail(String email) {
		return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
	}

	@PrePersist
	@PreUpdate
	void normalize() {
		this.email = normalizeEmail(email);
	}

	public String getEmail() {
		return email;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public void setPasswordHash(String passwordHash) {
		this.passwordHash = passwordHash;
	}

	public String getNombre() {
		return nombre;
	}

	public void setNombre(String nombre) {
		this.nombre = nombre;
	}

	public Rol getRol() {
		return rol;
	}

	public void setRol(Rol rol) {
		this.rol = rol;
	}

	public boolean isActivo() {
		return activo;
	}

	public void setActivo(boolean activo) {
		this.activo = activo;
	}

	public Instant getUltimoLogin() {
		return ultimoLogin;
	}

	public void setUltimoLogin(Instant ultimoLogin) {
		this.ultimoLogin = ultimoLogin;
	}
}
