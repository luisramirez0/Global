package ar.global.odonto.paciente;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/** Notas clinicas. Sin operaciones de edicion en el servicio: las notas son inmutables (C-08 D2). */
public interface NotaClinicaRepository extends JpaRepository<NotaClinica, Long> {

	Page<NotaClinica> findByPacienteId(Long pacienteId, Pageable pageable);
}
