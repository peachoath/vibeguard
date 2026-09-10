package dev.vibeguard.api.scan;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** scans 테이블 접근. */
public interface ScanRepository extends JpaRepository<Scan, UUID> {

    List<Scan> findByRepositoryIdOrderByCreatedAtDesc(UUID repositoryId);

    /** 동일 repo+ref로 진행 중(비종료) 스캔이 있는지 — 중복 스캔 방지(409)에 사용. */
    boolean existsByRepositoryIdAndRefAndStatusIn(UUID repositoryId, String ref, Collection<ScanStatus> statuses);
}
