package dev.vibeguard.api.scan;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** scans 테이블 접근. */
public interface ScanRepository extends JpaRepository<Scan, UUID> {

    List<Scan> findByRepositoryIdOrderByCreatedAtDesc(UUID repositoryId);

    /** 동일 repo+ref로 진행 중(비종료) 스캔이 있는지 — 중복 스캔 방지(409)에 사용. */
    boolean existsByRepositoryIdAndRefAndStatusIn(UUID repositoryId, String ref, Collection<ScanStatus> statuses);

    /** 특정 상태의 스캔 수 (대시보드 성공률 계산용). */
    long countByStatus(ScanStatus status);

    /** 특정 상태들의 스캔 수. */
    long countByStatusIn(Collection<ScanStatus> statuses);

    /** 완료된 스캔의 평균 소요 시간(ms). 없으면 null. */
    @Query("select avg(s.durationMs) from Scan s where s.durationMs is not null")
    Double averageDurationMs();
}
