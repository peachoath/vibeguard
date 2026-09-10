package dev.vibeguard.api.scan;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** scans 테이블 접근. */
public interface ScanRepository extends JpaRepository<Scan, UUID> {

    List<Scan> findByRepositoryIdOrderByCreatedAtDesc(UUID repositoryId);

    boolean existsByRepositoryIdAndRefAndStatusNot(UUID repositoryId, String ref, ScanStatus status);
}
