package ar.global.odonto.consultorio;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

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

	/**
	 * {@code SELECT ... FOR UPDATE} sobre la fila del consultorio (C-04 design D7). Debe ser la PRIMERA
	 * sentencia de la transaccion de escritura con invariantes entre filas; el lock se libera al commit.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select c from Consultorio c where c.id = :id")
	Optional<Consultorio> lockById(@Param("id") Long id);
}
