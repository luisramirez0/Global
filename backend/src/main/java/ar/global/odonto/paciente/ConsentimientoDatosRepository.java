package ar.global.odonto.paciente;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** Consentimientos de datos; todas las consultas quedan acotadas al consultorio por el filtro de tenant. */
public interface ConsentimientoDatosRepository extends JpaRepository<ConsentimientoDatos, Long> {

	/** Regla de C-08 (design D3): alcanza con un consentimiento de cualquier version. */
	boolean existsByPacienteId(Long pacienteId);

	List<ConsentimientoDatos> findByPacienteIdOrderByAceptadoEnDescIdDesc(Long pacienteId);
}
