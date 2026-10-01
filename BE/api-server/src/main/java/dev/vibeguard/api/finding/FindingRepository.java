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

    /** A2 검증 결과를 스캔의 모든 Finding에 반영할 때 사용. */
    java.util.List<Finding> findAllByScanId(UUID scanId);

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

    /** 현재 사용자가 연결한 저장소의 Finding 심각도 분포. */
    @Query("select f.severity, count(f) from Finding f "
        + "join Scan s on s.id = f.scanId "
        + "join Repository r on r.id = s.repositoryId "
        + "where r.userId = :userId group by f.severity")
    java.util.List<Object[]> countBySeverityForUser(@Param("userId") UUID userId);

    /**
     * Finding 소유권 검증 조회 — IDOR 방지용.
     * finding → scan → repository → user 경로로 검증.
     * 존재하지 않거나 소유권 없는 경우 모두 empty 반환(존재 여부 미노출).
     */
    @Query("select f from Finding f "
        + "join Scan s on s.id = f.scanId "
        + "join Repository r on r.id = s.repositoryId "
        + "where f.id = :findingId and r.userId = :userId")
    java.util.Optional<Finding> findByIdAndUserId(
        @Param("findingId") UUID findingId,
        @Param("userId") UUID userId);

    /**
     * 스캔이 해당 사용자 소유인지 확인 — Finding 목록 조회 전 스캔 소유권 사전 검증용.
     */
    @Query("select count(s) > 0 from Scan s "
        + "join Repository r on r.id = s.repositoryId "
        + "where s.id = :scanId and r.userId = :userId")
    boolean isScanOwnedByUser(
        @Param("scanId") UUID scanId,
        @Param("userId") UUID userId);

    /**
     * A3 콜백에서 패치-Finding 연결용 — scanId + packageName으로 Finding 단건 조회.
     * 같은 패키지가 여러 CVE로 중복 등록된 경우 첫 번째(생성순)를 반환한다.
     */
    java.util.Optional<Finding> findFirstByScanIdAndPackageNameOrderByIdAsc(
        UUID scanId,
        String packageName);
}
