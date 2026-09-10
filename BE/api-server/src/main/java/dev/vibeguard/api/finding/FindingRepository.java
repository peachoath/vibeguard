package dev.vibeguard.api.finding;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** findings 테이블 접근. */
public interface FindingRepository extends JpaRepository<Finding, UUID> {

    Page<Finding> findByScanId(UUID scanId, Pageable pageable);

    /**
     * 스캔별 Finding 필터 조회. severity/type/status는 null이면 해당 조건 무시.
     * (nullable 필터를 JPQL의 (:param is null or ...) 관용구로 처리)
     */
    @Query("""
        select f from Finding f
        where f.scanId = :scanId
          and (:severity is null or f.severity = :severity)
          and (:type is null or f.type = :type)
          and (:status is null or f.status = :status)
        """)
    Page<Finding> search(
        @Param("scanId") UUID scanId,
        @Param("severity") Severity severity,
        @Param("type") FindingType type,
        @Param("status") FindingStatus status,
        Pageable pageable);

    /** 대시보드 심각도 분포 집계용. */
    @Query("select f.severity, count(f) from Finding f group by f.severity")
    java.util.List<Object[]> countBySeverity();
}
