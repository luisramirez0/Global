package ar.global.odonto.usuario;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

	/**
	 * Busca por email (el llamador lo normaliza con {@link Usuario#normalizeEmail}). Con tenant en curso
	 * solo ve su consultorio; el login lo invoca dentro de {@code TenantContext.runAsSystem}.
	 */
	Optional<Usuario> findByEmail(String email);
}
