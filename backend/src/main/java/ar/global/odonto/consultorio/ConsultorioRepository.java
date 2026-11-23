package ar.global.odonto.consultorio;

import java.util.Optional;
import org.springframework.data.repository.Repository;

/**
 * Acceso mínimo al consultorio: solo {@code findById} y {@code save}. El "mi consultorio" de C-04 busca
 * por {@code TenantContext.require()}; el alta corre en modo sistema.
 */
public interface ConsultorioRepository extends Repository<Consultorio, Long> {

	Optional<Consultorio> findById(Long id);

	Consultorio save(Consultorio consultorio);
}
