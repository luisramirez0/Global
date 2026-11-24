package ar.global.odonto.auditoria;

import java.lang.reflect.Method;
import org.springframework.core.DefaultParameterNameDiscoverer;
import org.springframework.core.ParameterNameDiscoverer;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.SimpleEvaluationContext;

/**
 * Evalua {@code @Audited.entidadId} (SpEL) sobre los argumentos (por nombre, {@code #id}, o por posicion,
 * {@code #p0}) y el resultado ({@code #result}). Debe dar {@code Long}, {@code Integer} o {@code null}; otro tipo
 * o un error de evaluacion es un error de programacion: {@link IllegalStateException} sin el valor evaluado
 * (puede ser PII, regla 5), que el aspecto convierte en falla de la operacion (design D2, D3).
 *
 * <p>
 * Contexto de solo lectura ({@link SimpleEvaluationContext}): sin acceso a tipos, constructores ni beans.
 */
final class EntidadIdExpression {

	private static final ExpressionParser PARSER = new SpelExpressionParser();
	private static final ParameterNameDiscoverer NOMBRES = new DefaultParameterNameDiscoverer();

	private EntidadIdExpression() {
	}

	static Long evaluar(String expresion, Method metodo, Object[] args, Object resultado) {
		if (expresion == null || expresion.isBlank()) {
			return null;
		}
		try {
			SimpleEvaluationContext ctx = SimpleEvaluationContext.forReadOnlyDataBinding().withInstanceMethods()
					.build();
			String[] nombres = NOMBRES.getParameterNames(metodo);
			for (int i = 0; i < args.length; i++) {
				ctx.setVariable("p" + i, args[i]);
				if (nombres != null) {
					ctx.setVariable(nombres[i], args[i]);
				}
			}
			ctx.setVariable("result", resultado);
			Object valor = PARSER.parseExpression(expresion).getValue((EvaluationContext) ctx);
			if (valor == null) {
				return null;
			}
			if (valor instanceof Long l) {
				return l;
			}
			if (valor instanceof Integer i) {
				return i.longValue();
			}
			throw new IllegalStateException("entidadId de @Audited no es numerico: " + valor.getClass().getName());
		}
		catch (IllegalStateException e) {
			throw e;
		}
		catch (RuntimeException e) {
			throw new IllegalStateException("entidadId de @Audited no evaluable: " + e.getClass().getName());
		}
	}
}
