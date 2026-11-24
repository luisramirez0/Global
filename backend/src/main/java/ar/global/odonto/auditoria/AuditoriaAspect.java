package ar.global.odonto.auditoria;

import ar.global.odonto.common.tenant.TenantContext;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * ZONA DE RIESGO (regla 12). Implementa {@link Audited} (design D2, D3).
 *
 * <p>
 * Ejecuta el metodo Y el registro dentro de un {@code TransactionTemplate} {@code REQUIRED} de lectura-escritura:
 * si el metodo ya corre en una transaccion, se une a ella. Si el registro falla (detalle/SpEL invalido, FK, base
 * caida) la transaccion se revierte, se loguea {@code ERROR} solo con ids y tipo de excepcion (nunca el mensaje,
 * regla 5) y se lanza {@link AuditoriaFallidaException}: la operacion no devuelve datos sin registro.
 *
 * <p>
 * Orden {@value #ORDEN}: dentro de {@code @PreAuthorize} (Spring Security, ordenes 100-600) y fuera de
 * {@code @Transactional} ({@code LOWEST_PRECEDENCE}); asi la transaccion la abre el aspecto en lectura-escritura.
 */
@Aspect
@Component
@Order(AuditoriaAspect.ORDEN)
public class AuditoriaAspect {

	static final int ORDEN = Ordered.LOWEST_PRECEDENCE - 100;

	private static final Logger log = LoggerFactory.getLogger(AuditoriaAspect.class);

	private final TransactionTemplate tx;
	private final AuditService auditService;

	public AuditoriaAspect(TransactionTemplate tx, AuditService auditService) {
		this.tx = tx;
		this.auditService = auditService;
	}

	@Around("@annotation(audited)")
	public Object auditar(ProceedingJoinPoint pjp, Audited audited) throws Throwable {
		Throwable[] checked = new Throwable[1];
		Object resultado = tx.execute(status -> {
			Object valor;
			try {
				valor = pjp.proceed();
			}
			catch (RuntimeException | Error e) {
				throw e;
			}
			catch (Throwable t) {
				checked[0] = t;
				status.setRollbackOnly();
				return null;
			}
			registrar(pjp, audited, valor);
			return valor;
		});
		if (checked[0] != null) {
			throw checked[0];
		}
		return resultado;
	}

	private void registrar(ProceedingJoinPoint pjp, Audited audited, Object valor) {
		Long entidadId = null;
		try {
			MethodSignature firma = (MethodSignature) pjp.getSignature();
			entidadId = EntidadIdExpression.evaluar(audited.entidadId(), firma.getMethod(), pjp.getArgs(), valor);
			auditService.registrar(audited.accion(), audited.entidad(), entidadId, DetalleAuditoria.vacio());
		}
		catch (RuntimeException e) {
			log.error("Fallo de auditoria accion={} entidad={} entidadId={} consultorioId={} causa={}", audited.accion(),
					audited.entidad(), entidadId, TenantContext.get().orElse(null), e.getClass().getSimpleName());
			throw new AuditoriaFallidaException();
		}
	}
}
