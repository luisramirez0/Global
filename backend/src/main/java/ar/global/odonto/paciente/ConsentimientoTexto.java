package ar.global.odonto.paciente;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.Immutable;

/**
 * Catalogo global y de solo lectura de textos de consentimiento (no tiene {@code consultorio_id}).
 * La version {@code v1} se siembra en la migracion V2.
 */
@Entity
@Immutable
@Table(name = "consentimiento_texto")
public class ConsentimientoTexto {

	@Id
	@Column(length = 20)
	private String version;

	@Column(nullable = false, columnDefinition = "TEXT")
	private String contenido;

	@Column(name = "vigente_desde", nullable = false)
	private Instant vigenteDesde;

	protected ConsentimientoTexto() {
	}

	public String getVersion() {
		return version;
	}

	public String getContenido() {
		return contenido;
	}

	public Instant getVigenteDesde() {
		return vigenteDesde;
	}

	@Override
	public String toString() {
		return "ConsentimientoTexto#" + version;
	}
}
