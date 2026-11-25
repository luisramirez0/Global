package ar.global.odonto.paciente.export;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import ar.global.odonto.agenda.EstadoTurno;

/**
 * Paquete de datos de un paciente (design D2; regla 1: nunca entidades). Sin consultorio, sin {@code version} de
 * bloqueo optimista y sin el log de auditoria. {@code ficha} es {@code null} si no fue cargada. Los
 * {@code toString} no imprimen datos personales ni clinicos (regla 5).
 */
public record PacienteExportResponse(Instant exportadoEn, DatosPaciente paciente,
		List<Consentimiento> consentimientos, Ficha ficha, List<Nota> notas, List<TurnoExportado> turnos) {

	public record DatosPaciente(Long id, String nombre, String apellido, String dni, LocalDate fechaNacimiento,
			String sexo, String telefono, String email, String direccion, String obraSocialTexto, boolean activo) {

		@Override
		public String toString() {
			return "DatosPaciente[id=" + id + "]";
		}
	}

	public record Consentimiento(Long id, String versionTexto, Instant aceptadoEn, Long registradoPorUsuarioId) {
	}

	public record Ficha(String alergias, String medicacionActual, String antecedentesMedicos,
			String enfermedadesRelevantes, Boolean embarazo, String motivoConsulta, String observaciones,
			Instant actualizadaEn) {

		@Override
		public String toString() {
			return "Ficha[]";
		}
	}

	public record Nota(Long id, Instant fecha, Long profesionalId, Long turnoId, String texto) {

		@Override
		public String toString() {
			return "Nota[id=" + id + "]";
		}
	}

	public record Referencia(Long id, String nombre) {
	}

	public record TurnoExportado(Long id, Instant inicio, Instant fin, EstadoTurno estado, boolean sobreturno,
			String motivoCancelacion, String notas, Long profesionalId, Referencia prestacion, Referencia sillon) {

		@Override
		public String toString() {
			return "TurnoExportado[id=" + id + "]";
		}
	}

	@Override
	public String toString() {
		return "PacienteExportResponse[pacienteId=" + (paciente == null ? null : paciente.id()) + "]";
	}
}
