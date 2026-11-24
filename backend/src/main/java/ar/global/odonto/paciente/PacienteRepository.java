package ar.global.odonto.paciente;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PacienteRepository extends JpaRepository<Paciente, Long> {

	/** El filtro de tenant garantiza que solo se busca dentro del consultorio en curso. */
	Optional<Paciente> findByDni(String dni);

	/**
	 * Busqueda por nombre/apellido (contiene) o prefijo de DNI, acotada al consultorio en curso por el filtro de
	 * tenant (C-05 design D5). Los patrones los arma {@code paciente.abm.CriterioBusqueda} (escape {@code !});
	 * JPQL portable, sin SQL nativo (regla 8).
	 */
	@Query("""
			select p from Paciente p
			where (:incluirInactivos = true or p.activo = true)
			  and (:patron is null
			    or lower(concat(p.apellido, ' ', p.nombre)) like :patron escape '!'
			    or lower(concat(p.nombre, ' ', p.apellido)) like :patron escape '!'
			    or (:dniPrefijo is not null and p.dni like :dniPrefijo escape '!'))
			""")
	Page<Paciente> buscar(@Param("patron") String patron, @Param("dniPrefijo") String dniPrefijo,
			@Param("incluirInactivos") boolean incluirInactivos, Pageable pageable);
}
