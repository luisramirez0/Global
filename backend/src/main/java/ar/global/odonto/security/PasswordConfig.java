package ar.global.odonto.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * ZONA DE RIESGO (regla 12: seguridad/auth). Define el hash de contrasenas: BCrypt con costo 12.
 * Lo define C-02 porque el seed de desarrollo lo necesita; C-03 (auth) lo reutiliza. Requiere review
 * del revisor de seguridad.
 */
@Configuration(proxyBeanMethods = false)
public class PasswordConfig {

	private static final int BCRYPT_STRENGTH = 12;

	@Bean
	public PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder(BCRYPT_STRENGTH);
	}
}
