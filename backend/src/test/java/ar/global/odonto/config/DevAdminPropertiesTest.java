package ar.global.odonto.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.io.ClassPathResource;

class DevAdminPropertiesTest {

	private final ApplicationContextRunner runner = new ApplicationContextRunner().withInitializer(ctx -> {
		try {
			new YamlPropertySourceLoader().load("application", new ClassPathResource("application.yml"))
					.forEach(ps -> ctx.getEnvironment().getPropertySources().addLast(ps));
		}
		catch (IOException e) {
			throw new IllegalStateException(e);
		}
	}).withUserConfiguration(PropertiesConfig.class);

	@Test
	void emailDefaultsToAdminDevLocal() {
		runner.run(ctx -> assertThat(ctx.getBean(AppProperties.class).devAdmin().email())
				.isEqualTo("admin@dev.local"));
	}

	@Test
	void emailComesFromTheEnvironmentWhenDefined() {
		runner.withPropertyValues("DEV_ADMIN_EMAIL=otro@dev.local")
				.run(ctx -> assertThat(ctx.getBean(AppProperties.class).devAdmin().email())
						.isEqualTo("otro@dev.local"));
	}

	@Test
	void passwordHasNoDefault() {
		runner.run(ctx -> assertThat(ctx.getBean(AppProperties.class).devAdmin().password()).isNullOrEmpty());
	}

	@Test
	void passwordComesFromTheEnvironmentWhenDefined() {
		runner.withPropertyValues("DEV_ADMIN_PASSWORD=algo-de-prueba")
				.run(ctx -> assertThat(ctx.getBean(AppProperties.class).devAdmin().password())
						.isEqualTo("algo-de-prueba"));
	}

	@Test
	void envExampleListsBothVariablesWithoutARealPassword() throws IOException {
		// El test corre con cwd = backend/; .env.example vive en la raiz del repo.
		List<String> lines = Files.readAllLines(Path.of("..", ".env.example"));

		assertThat(lines).anyMatch(l -> l.startsWith("DEV_ADMIN_EMAIL="));
		String passwordLine = lines.stream().filter(l -> l.startsWith("DEV_ADMIN_PASSWORD=")).findFirst()
				.orElseThrow(() -> new AssertionError("Falta DEV_ADMIN_PASSWORD en .env.example"));
		assertThat(passwordLine.substring("DEV_ADMIN_PASSWORD=".length()).trim()).isIn("", "changeme");
	}
}
