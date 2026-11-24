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
}
