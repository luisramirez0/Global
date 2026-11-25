package ar.global.odonto.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.io.ClassPathResource;

/**
 * C-16: sin perfil por defecto. Un arranque sin {@code SPRING_PROFILES_ACTIVE} no debe activar {@code dev}
 * (seed y credenciales de desarrollo); el perfil lo fija explícitamente {@code docker-compose.yml}.
 */
class ProfileDefaultsTest {

	@Test
	void applicationYmlDeclaresNoDefaultProfile() throws Exception {
		var sources = new YamlPropertySourceLoader().load("application", new ClassPathResource("application.yml"));
		assertThat(sources).isNotEmpty().allSatisfy(s -> {
			assertThat(s.getProperty("spring.profiles.default")).isNull();
			assertThat(s.getProperty("spring.profiles.active")).isNull();
		});
	}

	@Test
	void dockerComposeActivatesTheDevProfileForTheBackend() throws Exception {
		// El test corre con cwd = backend/; docker-compose.yml vive en la raíz del repo.
		String compose = Files.readString(Path.of("..", "docker-compose.yml"));
		assertThat(compose).containsPattern("(?m)^\\s+SPRING_PROFILES_ACTIVE:\\s*dev\\s*$");
	}
}
