package ar.global.odonto.paciente;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PacienteRepository extends JpaRepository<Paciente, Long> {

	/** El filtro de tenant garantiza que solo se busca dentro del consultorio en curso. */
	Optional<Paciente> findByDni(String dni);
}
