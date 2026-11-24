package ar.global.odonto.agenda;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PrestacionRepository extends JpaRepository<Prestacion, Long> {

	List<Prestacion> findAllByOrderByNombre();

	List<Prestacion> findAllByActivoTrueOrderByNombre();
}
