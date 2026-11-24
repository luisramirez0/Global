package ar.global.odonto.agenda;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SillonRepository extends JpaRepository<Sillon, Long> {

	long countByActivoTrue();

	List<Sillon> findAllByActivoTrueOrderByNombre();

	List<Sillon> findAllByOrderByNombre();
}
