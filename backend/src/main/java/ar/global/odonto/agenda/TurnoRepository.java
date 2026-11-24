package ar.global.odonto.agenda;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Turnos del consultorio en curso (el tenant lo agrega Hibernate). Consultas de C-07 en JPQL portable: intervalos
 * semiabiertos {@code [inicio, fin)} y los {@code CANCELADO} no ocupan lugar (design D2).
 */
public interface TurnoRepository extends JpaRepository<Turno, Long> {

	@Query("""
			select t from Turno t
			where t.sillon.id = :sillonId
			  and t.estado <> ar.global.odonto.agenda.EstadoTurno.CANCELADO
			  and t.inicio < :fin and t.fin > :inicio
			  and (:excluirId is null or t.id <> :excluirId)
			order by t.inicio, t.id
			""")
	List<Turno> conflictosSillon(@Param("sillonId") Long sillonId, @Param("inicio") Instant inicio,
			@Param("fin") Instant fin, @Param("excluirId") Long excluirId, Limit limit);

	@Query("""
			select t from Turno t
			where t.profesional.id = :profesionalId
			  and t.estado <> ar.global.odonto.agenda.EstadoTurno.CANCELADO
			  and t.inicio < :fin and t.fin > :inicio
			  and (:excluirId is null or t.id <> :excluirId)
			order by t.inicio, t.id
			""")
	List<Turno> conflictosProfesional(@Param("profesionalId") Long profesionalId, @Param("inicio") Instant inicio,
			@Param("fin") Instant fin, @Param("excluirId") Long excluirId, Limit limit);

	/** Primer turno no cancelado del sillon que se cruza con {@code [inicio, fin)}, sin contar {@code excluirId}. */
	default Optional<Turno> primerConflictoSillon(Long sillonId, Instant inicio, Instant fin, Long excluirId) {
		return conflictosSillon(sillonId, inicio, fin, excluirId, Limit.of(1)).stream().findFirst();
	}

	/** Primer turno no cancelado del profesional que se cruza con {@code [inicio, fin)}, sin contar {@code excluirId}. */
	default Optional<Turno> primerConflictoProfesional(Long profesionalId, Instant inicio, Instant fin,
			Long excluirId) {
		return conflictosProfesional(profesionalId, inicio, fin, excluirId, Limit.of(1)).stream().findFirst();
	}

	/** Agenda por rango (design D10): paciente y prestacion en la misma consulta para la vista (sin N+1). */
	@Query("""
			select t from Turno t
			join fetch t.paciente
			join fetch t.prestacion
			where t.inicio < :hasta and t.fin > :desde
			  and (:sillonId is null or t.sillon.id = :sillonId)
			  and (:profesionalId is null or t.profesional.id = :profesionalId)
			  and (:incluirCancelados = true or t.estado <> ar.global.odonto.agenda.EstadoTurno.CANCELADO)
			order by t.inicio, t.id
			""")
	List<Turno> buscarAgenda(@Param("desde") Instant desde, @Param("hasta") Instant hasta,
			@Param("sillonId") Long sillonId, @Param("profesionalId") Long profesionalId,
			@Param("incluirCancelados") boolean incluirCancelados);
}
