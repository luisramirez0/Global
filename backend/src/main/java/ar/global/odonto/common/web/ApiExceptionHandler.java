package ar.global.odonto.common.web;

import ar.global.odonto.common.tenant.TenantNotSetException;
import ar.global.odonto.consultorio.registro.EmailYaRegistradoException;
import ar.global.odonto.paciente.abm.DatoInvalidoException;
import ar.global.odonto.paciente.abm.DniDuplicadoException;
import ar.global.odonto.paciente.ficha.ProfesionalNoVinculadoException;
import ar.global.odonto.security.DemasiadosIntentosException;
import ar.global.odonto.usuario.auth.CredencialesInvalidasException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.TypeMismatchException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Errores de la API como {@code ProblemDetail} (RFC 9457, design D3). Nunca devuelve valores enviados por el
 * cliente, mensajes de excepciones internas ni trazas; los logs registran solo tipos de excepcion y ubicacion,
 * nunca mensajes (pueden contener PII, regla 5).
 */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

	@Override
	protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "Datos inválidos",
				"La solicitud tiene campos inválidos.");
		List<Map<String, String>> errores = ex.getBindingResult().getFieldErrors().stream()
				.map(e -> Map.of("campo", e.getField(), "mensaje", String.valueOf(e.getDefaultMessage())))
				.toList();
		problem.setProperty("errores", errores);
		return ResponseEntity.badRequest().body(problem);
	}

	/**
	 * Parametro con tipo invalido (p. ej. {@code /api/pacientes/abc}). El handler por defecto repite el valor en
	 * {@code detail} y en {@code instance}: se responde solo con el nombre del parametro e {@code instance}
	 * neutralizado como en el resto de los errores.
	 */
	@Override
	protected ResponseEntity<Object> handleTypeMismatch(TypeMismatchException ex, HttpHeaders headers,
			HttpStatusCode status, WebRequest request) {
		String campo = ex instanceof MethodArgumentTypeMismatchException m ? m.getName() : ex.getPropertyName();
		return ResponseEntity.badRequest().body(invalidos(List.of(campo == null ? "parametro" : campo)));
	}

	@ExceptionHandler(DatoInvalidoException.class)
	ResponseEntity<ProblemDetail> datoInvalido(DatoInvalidoException ex) {
		return of(invalidos(ex.getCampos()));
	}

	@ExceptionHandler(ValidacionException.class)
	ResponseEntity<ProblemDetail> validacion(ValidacionException ex) {
		ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "Datos inválidos",
				"La solicitud tiene campos inválidos.");
		problem.setProperty("errores", List.of(Map.of("campo", ex.getCampo(), "mensaje", ex.getMensaje())));
		return of(problem);
	}

	@ExceptionHandler(RecursoNoEncontradoException.class)
	ResponseEntity<ProblemDetail> noEncontrado(RecursoNoEncontradoException ex) {
		ProblemDetail problem = problem(HttpStatus.NOT_FOUND, "Recurso no encontrado",
				"El recurso solicitado no existe.");
		return of(problem);
	}

	@ExceptionHandler(DniDuplicadoException.class)
	ResponseEntity<ProblemDetail> dniDuplicado(DniDuplicadoException ex) {
		ProblemDetail problem = problem(HttpStatus.CONFLICT, "DNI ya registrado", ex.getMessage());
		problem.setProperty("pacienteId", ex.getPacienteId());
		return of(problem);
	}

	@ExceptionHandler(ConflictoException.class)
	ResponseEntity<ProblemDetail> conflicto(ConflictoException ex) {
		ProblemDetail problem = problem(HttpStatus.CONFLICT, ex.getTitulo(), "La operación viola una regla de negocio.");
		if (ex.getCodigo() != null) {
			problem.setProperty("codigo", ex.getCodigo());
		}
		return of(problem);
	}

	/** Edicion concurrente detectada por {@code @Version}: 409 generico, sin nombrar la entidad ni el id. */
	@ExceptionHandler(ObjectOptimisticLockingFailureException.class)
	ResponseEntity<ProblemDetail> edicionConcurrente(ObjectOptimisticLockingFailureException ex) {
		return of(problem(HttpStatus.CONFLICT, "Edición concurrente",
				"El recurso cambió mientras se editaba. Volvé a cargarlo."));
	}

	@ExceptionHandler(ProfesionalNoVinculadoException.class)
	ResponseEntity<ProblemDetail> profesionalNoVinculado(ProfesionalNoVinculadoException ex) {
		ProblemDetail problem = problem(HttpStatus.UNPROCESSABLE_ENTITY, "Profesional no vinculado",
				"El usuario no está vinculado a un profesional activo.");
		problem.setProperty("codigo", ex.getCodigo());
		return of(problem);
	}

	@ExceptionHandler(ReferenciaInvalidaException.class)
	ResponseEntity<ProblemDetail> referenciaInvalida(ReferenciaInvalidaException ex) {
		ProblemDetail problem = problem(HttpStatus.UNPROCESSABLE_ENTITY, "Referencia inválida",
				"La solicitud referencia un recurso inexistente o no permitido.");
		problem.setProperty("errores", List.of(Map.of("campo", ex.getCampo(), "mensaje", "referencia inválida")));
		return of(problem);
	}

	@ExceptionHandler(EmailYaRegistradoException.class)
	ResponseEntity<ProblemDetail> emailDuplicado(EmailYaRegistradoException ex) {
		return of(problem(HttpStatus.CONFLICT, "Email ya registrado", ex.getMessage()));
	}

	@ExceptionHandler(CredencialesInvalidasException.class)
	ResponseEntity<ProblemDetail> credenciales(CredencialesInvalidasException ex) {
		return ResponseEntity.status(HttpStatus.UNAUTHORIZED).header(HttpHeaders.WWW_AUTHENTICATE, "Bearer")
				.body(problem(HttpStatus.UNAUTHORIZED, "No autenticado", ex.getMessage()));
	}

	@ExceptionHandler(AuthenticationException.class)
	ResponseEntity<ProblemDetail> noAutenticado(AuthenticationException ex) {
		return ResponseEntity.status(HttpStatus.UNAUTHORIZED).header(HttpHeaders.WWW_AUTHENTICATE, "Bearer")
				.body(problem(HttpStatus.UNAUTHORIZED, "No autenticado", "Se requiere un token válido."));
	}

	@ExceptionHandler(AccessDeniedException.class)
	ResponseEntity<ProblemDetail> denegado(AccessDeniedException ex) {
		return of(problem(HttpStatus.FORBIDDEN, "Acceso denegado", "Tu rol no permite esta operación."));
	}

	@ExceptionHandler(DemasiadosIntentosException.class)
	ResponseEntity<ProblemDetail> demasiadosIntentos(DemasiadosIntentosException ex) {
		return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
				.header(HttpHeaders.RETRY_AFTER, String.valueOf(ex.getRetryAfterSeconds()))
				.body(problem(HttpStatus.TOO_MANY_REQUESTS, "Demasiados intentos",
						"Esperá antes de volver a intentar."));
	}

	@ExceptionHandler(Exception.class)
	ResponseEntity<ProblemDetail> inesperado(Exception ex, HttpServletRequest request) {
		Throwable root = rootCause(ex);
		if (root instanceof TenantNotSetException) {
			log.error("Acceso a datos sin tenant en {} {} (bug: falta TenantContext)", request.getMethod(),
					request.getRequestURI());
		}
		else {
			StackTraceElement where = root.getStackTrace().length > 0 ? root.getStackTrace()[0] : null;
			log.error("Error no controlado {} (causa {}) en {} {} [{}]", ex.getClass().getName(),
					root.getClass().getName(), request.getMethod(), request.getRequestURI(), where);
		}
		return of(problem(HttpStatus.INTERNAL_SERVER_ERROR, "Error interno", "Ocurrió un error inesperado."));
	}

	/** Mismo formato que Bean Validation: lista de campos con un mensaje fijo, nunca el valor recibido. */
	private static ProblemDetail invalidos(List<String> campos) {
		ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "Datos inválidos",
				"La solicitud tiene campos inválidos.");
		problem.setProperty("errores", campos.stream().map(c -> Map.of("campo", c, "mensaje", "formato inválido"))
				.toList());
		return problem;
	}

	private static ProblemDetail problem(HttpStatus status, String title, String detail) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
		problem.setTitle(title);
		// Spring completaria "instance" con la ruta pedida, que puede contener el id consultado: se neutraliza.
		problem.setInstance(java.net.URI.create("about:blank"));
		return problem;
	}

	private static ResponseEntity<ProblemDetail> of(ProblemDetail problem) {
		return ResponseEntity.status(problem.getStatus()).body(problem);
	}

	private static Throwable rootCause(Throwable ex) {
		Throwable t = ex;
		while (t.getCause() != null && t.getCause() != t) {
			t = t.getCause();
		}
		return t;
	}
}
