package ar.global.odonto.agenda;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HorarioAtencionRepository extends JpaRepository<HorarioAtencion, Long> {

	List<HorarioAtencion> findAllByOrderByDiaSemanaAscHoraDesdeAsc();

	List<HorarioAtencion> findAllByProfesionalIdOrderByDiaSemanaAscHoraDesdeAsc(Long profesionalId);

	List<HorarioAtencion> findByProfesionalIdAndDiaSemana(Long profesionalId, int diaSemana);
}
