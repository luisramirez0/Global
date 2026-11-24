package ar.global.odonto.agenda.config;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

class DuracionEnGrillaValidatorTest {

	private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

	record Dto(@DuracionEnGrilla Integer duracionMinutos) {
	}

	@Test
	void durationOffTheGridIsAViolationOnTheField() {
		var violations = validator.validate(new Dto(GrillaAgenda.MINUTOS + 5));

		assertThat(violations).hasSize(1);
		assertThat(violations.iterator().next().getPropertyPath().toString()).isEqualTo("duracionMinutos");
	}

	@Test
	void durationOnTheGridIsValid() {
		assertThat(validator.validate(new Dto(3 * GrillaAgenda.MINUTOS))).isEmpty();
	}

	@Test
	void nullIsLeftToNotNull() {
		assertThat(validator.validate(new Dto(null))).isEmpty();
	}
}
