package dev.vibeguard.api.finding;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/** findings 테이블 접근. */
public interface FindingRepository extends JpaRepository<Finding, UUID> {

    Page<Finding> findByScanId(UUID scanId, Pageable pageable);
}
