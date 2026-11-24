package ar.global.odonto.agenda.config;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** La duracion (minutos) debe ser multiplo de la grilla vigente. {@code null} lo cubre {@code @NotNull}. */
@Documented
@Target({ ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER })
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = DuracionEnGrilla.Validator.class)
public @interface DuracionEnGrilla {

	String message() default "debe ser múltiplo de la grilla de la agenda";

	Class<?>[] groups() default {};

	Class<? extends Payload>[] payload() default {};

	class Validator implements ConstraintValidator<DuracionEnGrilla, Integer> {

		@Override
		public boolean isValid(Integer value, ConstraintValidatorContext context) {
			return value == null || GrillaAgenda.esDuracionValida(value);
		}
	}
}
