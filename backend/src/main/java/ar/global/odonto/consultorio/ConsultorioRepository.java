package ar.global.odonto.consultorio;

import java.util.Optional;
import org.springframework.data.repository.Repository;

/**
 * Acceso mínimo al consultorio: {@code findById}, {@code save} y {@code delete} (este último solo para la
 * compensación del registro, C-03). El "mi consultorio" de C-04 busca por {@code TenantContext.require()};
 * el alta corre en modo sistema.
 */
public interface ConsultorioRepository extends Repository<Consultorio, Long> {

	Optional<Consultorio> findById(Long id);

	Consultorio save(Consultorio consultorio);

	/** Solo para la compensacion del registro fallido (C-03, design D5), en modo sistema. */
	void delete(Consultorio consultorio);
}
