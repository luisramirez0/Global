package ar.global.odonto.agenda;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProfesionalRepository extends JpaRepository<Profesional, Long> {

	List<Profesional> findByActivoTrue();
}
