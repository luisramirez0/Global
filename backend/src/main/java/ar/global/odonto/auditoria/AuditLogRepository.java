package ar.global.odonto.auditoria;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.Repository;

/**
 * Solo alta y consulta: extiende {@code Repository} (no {@code JpaRepository}) a proposito, para que no
 * existan {@code delete*}, {@code saveAll} ni {@code flush} (design D3).
 */
public interface AuditLogRepository extends Repository<AuditLog, Long> {

	AuditLog save(AuditLog registro);

	Optional<AuditLog> findById(Long id);

	Page<AuditLog> findAll(Pageable pageable);
}
