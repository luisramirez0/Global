package ar.global.odonto.auditoria;

import java.time.Instant;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * Solo alta y consulta: extiende {@code Repository} (no {@code JpaRepository}) a proposito, para que no
 * existan {@code delete*}, {@code saveAll} ni {@code flush} (design D3).
 */
public interface AuditLogRepository extends Repository<AuditLog, Long> {

	AuditLog save(AuditLog registro);

	Optional<AuditLog> findById(Long id);

	Page<AuditLog> findAll(Pageable pageable);

	/**
	 * Consulta del log con filtros opcionales ({@code null} = sin filtro). {@code desde} inclusivo, {@code hasta}
	 * exclusivo. JPQL portable (sin SQL nativo, regla 8); el tenant lo agrega {@code @TenantId}. Orden fijo:
	 * mas reciente primero (el {@code Pageable} no debe traer sort).
	 */
	@Query(value = """
			select a from AuditLog a
			where (:desde is null or a.createdAt >= :desde)
			  and (:hasta is null or a.createdAt < :hasta)
			  and (:accion is null or a.accion = :accion)
			  and (:entidad is null or a.entidad = :entidad)
			  and (:entidadId is null or a.entidadId = :entidadId)
			  and (:usuarioId is null or a.usuarioId = :usuarioId)
			order by a.createdAt desc, a.id desc
			""", countQuery = """
			select count(a) from AuditLog a
			where (:desde is null or a.createdAt >= :desde)
			  and (:hasta is null or a.createdAt < :hasta)
			  and (:accion is null or a.accion = :accion)
			  and (:entidad is null or a.entidad = :entidad)
			  and (:entidadId is null or a.entidadId = :entidadId)
			  and (:usuarioId is null or a.usuarioId = :usuarioId)
			""")
	Page<AuditLog> buscar(@Param("desde") Instant desde, @Param("hasta") Instant hasta,
			@Param("accion") AccionAuditoria accion, @Param("entidad") String entidad,
			@Param("entidadId") Long entidadId, @Param("usuarioId") Long usuarioId, Pageable pageable);
}
