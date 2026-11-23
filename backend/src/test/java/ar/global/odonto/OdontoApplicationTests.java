package ar.global.odonto;

import static org.assertj.core.api.Assertions.assertThat;

import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
class OdontoApplicationTests {

	@Autowired
	private Environment environment;

	@Autowired
	private Flyway flyway;

	@Autowired
	private DataSource dataSource;

	@Test
	void contextLoadsWithTestProfile() {
		assertThat(environment.getActiveProfiles()).containsExactly("test");
	}

	@Test
	void flywayRunsOverH2InMySqlMode() {
		assertThat(flyway.getConfiguration().getLocations())
				.extracting(Object::toString)
				.containsExactly("classpath:db/migration");
		assertThat(flyway.info().pending()).isEmpty();
		String mode = new JdbcTemplate(dataSource)
				.queryForObject("SELECT SETTING_VALUE FROM INFORMATION_SCHEMA.SETTINGS WHERE SETTING_NAME = 'MODE'", String.class);
		assertThat(mode).isEqualTo("MySQL");
	}

	@Test
	void schemaIsOnlyValidatedNeverGenerated() {
		assertThat(environment.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
	}
}
