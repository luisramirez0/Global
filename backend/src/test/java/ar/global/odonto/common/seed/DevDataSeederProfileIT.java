package ar.global.odonto.common.seed;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;

/** Con el perfil test no existe el seeder y no se crea ningun consultorio ni usuario de desarrollo. */
@SpringBootTest
class DevDataSeederProfileIT {

	@Autowired
	private ApplicationContext context;

	@Autowired
	private JdbcTemplate jdbc;

	@Test
	void noSeederBeanUnderTestProfile() {
		assertThat(context.getBeansOfType(DevDataSeeder.class)).isEmpty();
	}

	@Test
	void noDevDataIsCreatedUnderTestProfile() {
		assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM usuario WHERE email = 'admin@dev.local'",
				Integer.class)).isZero();
	}
}
