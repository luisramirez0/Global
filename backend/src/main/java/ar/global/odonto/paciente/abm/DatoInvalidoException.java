package ar.global.odonto.paciente.abm;

import java.util.List;

/**
 * Uno o mas campos no cumplen el formato de dominio (DNI, telefono E.164) tras pasar Bean Validation: {@code 400}
 * con la lista de campos (design D3, D7). Ni el mensaje ni la respuesta incluyen el valor recibido (regla 5).
 */
public class DatoInvalidoException extends RuntimeException {

	private final List<String> campos;

	public DatoInvalidoException(List<String> campos) {
		super("Formato inválido en: " + String.join(", ", campos));
		this.campos = List.copyOf(campos);
	}

	public DatoInvalidoException(String campo) {
		this(List.of(campo));
	}

	public List<String> getCampos() {
		return campos;
	}
}
