package ar.global.odonto.common.web;

import ar.global.odonto.common.tenant.TenantNotSetException;
import ar.global.odonto.consultorio.registro.EmailYaRegistradoException;
import ar.global.odonto.paciente.abm.DatoInvalidoException;
import ar.global.odonto.paciente.abm.DniDuplicadoException;
import ar.global.odonto.security.DemasiadosIntentosException;
import ar.global.odonto.usuario.auth.CredencialesInvalidasException;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.net.URISyntaxException;
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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.HandlerMapping;
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
	 * {@code detail} y en {@code instance} (la URI): se responde con el nombre del parametro y el patron de la ruta.
	 */
	@Override
	protected ResponseEntity<Object> handleTypeMismatch(TypeMismatchException ex, HttpHeaders headers,
			HttpStatusCode status, WebRequest request) {
		String campo = ex instanceof MethodArgumentTypeMismatchException m ? m.getName() : ex.getPropertyName();
		ProblemDetail problem = invalidos(List.of(campo == null ? "parametro" : campo));
		Object pattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE,
				RequestAttributes.SCOPE_REQUEST);
		problem.setInstance(instanciaSegura(pattern));
		return ResponseEntity.badRequest().body(problem);
	}

	private static URI instanciaSegura(Object pattern) {
		try {
			// El constructor de varios argumentos codifica las llaves del patron ({id} -> %7Bid%7D).
			return pattern instanceof String path ? new URI(null, null, path, null) : URI.create("about:blank");
		}
		catch (URISyntaxException ex) {
			return URI.create("about:blank");
		}
	}

	@ExceptionHandler(DatoInvalidoException.class)
	ResponseEntity<ProblemDetail> datoInvalido(DatoInvalidoException ex) {
		return of(invalidos(ex.getCampos()));
	}

	@ExceptionHandler(RecursoNoEncontradoException.class)
	ResponseEntity<ProblemDetail> noEncontrado(RecursoNoEncontradoException ex) {
		return of(problem(HttpStatus.NOT_FOUND, "Recurso no encontrado", ex.getMessage()));
	}

	@ExceptionHandler(DniDuplicadoException.class)
	ResponseEntity<ProblemDetail> dniDuplicado(DniDuplicadoException ex) {
		ProblemDetail problem = problem(HttpStatus.CONFLICT, "DNI ya registrado", ex.getMessage());
		problem.setProperty("pacienteId", ex.getPacienteId());
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
