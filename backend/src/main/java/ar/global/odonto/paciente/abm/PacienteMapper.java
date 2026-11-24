package ar.global.odonto.paciente.abm;

import ar.global.odonto.paciente.Paciente;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Normalizacion de la entrada y mapeo entidad/DTO (design D2, D3). Nunca toca {@code activo} ni el consultorio. */
final class PacienteMapper {

	private PacienteMapper() {
	}

	/**
	 * Devuelve la solicitud normalizada: textos recortados (vacio = {@code null}), DNI sin separadores, telefono
	 * E.164 y email en minusculas. Reune todos los errores de formato en una sola {@link DatoInvalidoException}.
	 */
	static PacienteRequest normalizar(PacienteRequest req) {
		List<String> invalidos = new ArrayList<>();
		String dni = null;
		String telefono = null;
		try {
			dni = Dni.normalizar(req.dni());
		}
		catch (DatoInvalidoException ex) {
			invalidos.addAll(ex.getCampos());
		}
		try {
			telefono = TelefonoE164.normalizar(req.telefono());
		}
		catch (DatoInvalidoException ex) {
			invalidos.addAll(ex.getCampos());
		}
		if (!invalidos.isEmpty()) {
			throw new DatoInvalidoException(invalidos);
		}
		String email = limpiar(req.email());
		return new PacienteRequest(limpiar(req.nombre()), limpiar(req.apellido()), dni, req.fechaNacimiento(),
				limpiar(req.sexo()), telefono, email == null ? null : email.toLowerCase(Locale.ROOT),
				limpiar(req.direccion()), limpiar(req.obraSocialTexto()));
	}

	/** Copia una solicitud ya normalizada sobre la entidad. */
	static void aplicar(PacienteRequest datos, Paciente paciente) {
		paciente.setNombre(datos.nombre());
		paciente.setApellido(datos.apellido());
		paciente.setDni(datos.dni());
		paciente.setFechaNacimiento(datos.fechaNacimiento());
		paciente.setSexo(datos.sexo());
		paciente.setTelefono(datos.telefono());
		paciente.setEmail(datos.email());
		paciente.setDireccion(datos.direccion());
		paciente.setObraSocialTexto(datos.obraSocialTexto());
	}

	static PacienteResponse aResponse(Paciente p) {
		return new PacienteResponse(p.getId(), p.getNombre(), p.getApellido(), p.getDni(), p.getFechaNacimiento(),
				p.getSexo(), p.getTelefono(), p.getEmail(), p.getDireccion(), p.getObraSocialTexto(), p.isActivo());
	}

	private static String limpiar(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}
}
