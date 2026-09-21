package dev.vibeguard.api.audit;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** audit_logs 테이블 접근. */
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    List<AuditLog> findByScanIdOrderByTs(UUID scanId);
}
