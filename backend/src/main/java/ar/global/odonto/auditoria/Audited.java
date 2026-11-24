package ar.global.odonto.auditoria;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * ZONA DE RIESGO (regla 12). Declara que un metodo de servicio es una operacion auditable (RN-DS-02): al terminar
 * con exito registra una entrada en {@code audit_log} (consultorio del tenant, usuario e IP de la request) dentro
 * de la MISMA transaccion que la operacion (fail-closed, design D2).
 *
 * <p>
 * Reglas del contrato (C-07, C-08, C-15):
 * <ol>
 * <li>Solo en metodos {@code public} de beans de Spring invocados desde otro bean (proxy). No aplica en
 * auto-invocacion ni en metodos {@code private}/{@code final}. Cada consumidor debe tener un test que afirme la
 * entrada en {@code audit_log}.</li>
 * <li>Se registra DESPUES de que el metodo retorna sin excepcion; si lanza (negocio, 404, 403) no hay registro y
 * la excepcion sigue igual.</li>
 * <li>{@link #entidadId()} es SpEL sobre los argumentos (por nombre, {@code #pacienteId}, o posicion,
 * {@code #p0}) y {@code #result}; debe dar {@code Long}/{@code Integer}/{@code null}. Otro tipo o un error de
 * evaluacion hace fallar la operacion.</li>
 * <li><b>Los metodos auditados de lectura NO deben anotarse
 * {@code @Transactional(readOnly = true)}.</b> El INSERT de auditoria corre en la transaccion de la propia
 * operacion; si esa transaccion fuera de solo lectura, MySQL (el driver marca la conexion read-only) rechaza el
 * INSERT con "Connection is read-only", mientras que H2 no lo detecta y los tests en H2 pasarian igual. Si el
 * metodo auditado no declara {@code @Transactional}, el aspecto abre una transaccion de lectura-escritura; si
 * alguna capa interna declara {@code readOnly = true}, se une a la transaccion del aspecto (que es RW) y el flag
 * se ignora, pero no hay que apoyarse en eso: dejar el metodo auditado sin {@code readOnly}. Lo cubre el test
 * {@code AuditoriaAspectIT.auditedReadMustNotRunInAReadOnlyTransaction}.</li>
 * <li>Orden del aspecto: {@code LOWEST_PRECEDENCE - 100}. Queda dentro de {@code @PreAuthorize} (un 403 se
 * decide antes de abrir la transaccion de auditoria) y fuera del interceptor de {@code @Transactional}.</li>
 * <li>Detalle dinamico (p. ej. {@code sobreturno=true}), id no expresable, o metodos que capturan errores de
 * integridad fuera de su transaccion para traducirlos (patron de {@code PacienteService.crear}): no usar
 * {@code @Audited}; llamar a {@link AuditService#registrar} explicitamente dentro de la transaccion del
 * metodo.</li>
 * </ol>
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface Audited {

	AccionAuditoria accion();

	/** Nombre logico estable de la entidad (p. ej. {@code "FichaClinica"}); maximo 100 caracteres. */
	String entidad();

	/** SpEL del id de la entidad; vacio = sin id. */
	String entidadId() default "";
}
