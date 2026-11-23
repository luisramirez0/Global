package ar.global.odonto.paciente;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FichaClinicaRepository extends JpaRepository<FichaClinica, Long> {

	Optional<FichaClinica> findByPacienteId(Long pacienteId);
}
