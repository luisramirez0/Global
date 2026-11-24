package ar.global.odonto.paciente.ficha;

import ar.global.odonto.agenda.Profesional;
import java.util.List;
import org.springframework.data.repository.Repository;

/**
 * Lectura del profesional vinculado a un usuario, para el autor de las notas (design D7). Vive aca, y no en
 * {@code agenda.ProfesionalRepository}, para no modificar la zona de C-04 (design D12). Solo lectura.
 */
public interface ProfesionalVinculadoRepository extends Repository<Profesional, Long> {

	List<Profesional> findByUsuarioIdAndActivoTrue(Long usuarioId);
}
