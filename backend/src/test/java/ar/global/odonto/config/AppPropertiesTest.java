package ar.global.odonto.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.boot.env.YamlPropertySourceLoader;

class AppPropertiesTest {

	private final ApplicationContextRunner runner = new ApplicationContextRunner()
			.withInitializer(ctx -> {
				try {
					new YamlPropertySourceLoader()
							.load("application", new ClassPathResource("application.yml"))
							.forEach(ps -> ctx.getEnvironment().getPropertySources().addLast(ps));
				}
				catch (java.io.IOException e) {
					throw new IllegalStateException(e);
				}
			})
			.withUserConfiguration(PropertiesConfig.class);

	@Test
	void bindsCommaSeparatedCorsOrigins() {
		runner.withPropertyValues("CORS_ALLOWED_ORIGINS=http://a.test,http://b.test")
				.run(ctx -> assertThat(ctx.getBean(AppProperties.class).cors().allowedOrigins())
						.containsExactly("http://a.test", "http://b.test"));
	}

	@Test
	void usesLocalhostDefaultsWithoutEnvVars() {
		runner.run(ctx -> {
			AppProperties props = ctx.getBean(AppProperties.class);
			assertThat(props.baseUrl()).isEqualTo("http://localhost:5173");
			assertThat(props.cors().allowedOrigins()).containsExactly("http://localhost:5173");
		});
	}
}
