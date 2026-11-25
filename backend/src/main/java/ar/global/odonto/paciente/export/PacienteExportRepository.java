package ar.global.odonto.paciente.export;

import java.util.List;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import ar.global.odonto.agenda.Turno;
import ar.global.odonto.paciente.NotaClinica;
import ar.global.odonto.paciente.Paciente;

/**
 * Consultas de solo lectura del export (design D7). Extiende {@code Repository} (no {@code JpaRepository}) a
 * proposito: no expone {@code save}, {@code delete} ni {@code flush}. JPQL portable (regla 8); el tenant lo agrega
 * {@code @TenantId} en cada entidad. Los {@code join fetch} dejan cargado lo que el mapper necesita.
 */
public interface PacienteExportRepository extends Repository<Paciente, Long> {

	/** Turnos del paciente en todos los estados, del mas antiguo al mas nuevo. */
	@Query("""
			select t from Turno t
			join fetch t.prestacion
			join fetch t.sillon
			where t.paciente.id = :pacienteId
			order by t.inicio asc, t.id asc
			""")
	List<Turno> turnosDe(@Param("pacienteId") Long pacienteId);

	/** Notas clinicas del paciente, de la mas antigua a la mas nueva. */
	@Query("""
			select n from NotaClinica n
			join fetch n.profesional
			left join fetch n.turno
			where n.paciente.id = :pacienteId
			order by n.fecha asc, n.id asc
			""")
	List<NotaClinica> notasDe(@Param("pacienteId") Long pacienteId);
}
