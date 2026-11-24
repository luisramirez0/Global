package ar.global.odonto.agenda;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BloqueoAgendaRepository extends JpaRepository<BloqueoAgenda, Long> {

	/**
	 * Bloqueos que se intersecan con {@code [desde, hasta)} (extremos opcionales) y, si se indican, del sillon
	 * o profesional dados. JPQL puro (sin SQL nativo); el tenant lo agrega Hibernate.
	 */
	@Query("""
			select b from BloqueoAgenda b
			where (cast(:desde as instant) is null or b.fin > :desde)
			  and (cast(:hasta as instant) is null or b.inicio < :hasta)
			  and (:sillonId is null or b.sillon.id = :sillonId)
			  and (:profesionalId is null or b.profesional.id = :profesionalId)
			order by b.inicio, b.id
			""")
	List<BloqueoAgenda> buscar(@Param("desde") Instant desde, @Param("hasta") Instant hasta,
			@Param("sillonId") Long sillonId, @Param("profesionalId") Long profesionalId);

	/**
	 * Bloqueos que aplican a un turno (C-07 design D11, contrato de C-04): se intersecan con {@code [inicio, fin)}
	 * y su sillon y su profesional son nulos (cualquiera) o iguales a los del turno. A diferencia de
	 * {@link #buscar}, un ambito nulo SI incluye los bloqueos de todo el consultorio.
	 */
	@Query("""
			select b from BloqueoAgenda b
			where b.inicio < :fin and b.fin > :inicio
			  and (b.sillon is null or b.sillon.id = :sillonId)
			  and (b.profesional is null or b.profesional.id = :profesionalId)
			order by b.inicio, b.id
			""")
	List<BloqueoAgenda> aplicables(@Param("inicio") Instant inicio, @Param("fin") Instant fin,
			@Param("sillonId") Long sillonId, @Param("profesionalId") Long profesionalId);
}
