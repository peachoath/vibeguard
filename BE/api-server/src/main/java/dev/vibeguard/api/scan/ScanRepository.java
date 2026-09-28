package dev.vibeguard.api.scan;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** scans 테이블 접근. */
public interface ScanRepository extends JpaRepository<Scan, UUID> {

    List<Scan> findByRepositoryIdOrderByCreatedAtDesc(UUID repositoryId);

    @Query("select s from Scan s where s.repositoryId in "
        + "(select r.id from Repository r where r.userId = :userId) "
        + "order by s.createdAt desc limit 50")
    List<Scan> findTop50ByUser(UUID userId);

    /**
     * 스캔 소유권 검증 조회 — IDOR 방지용 (항목 2).
     * 스캔이 존재하지 않거나 해당 사용자 소유가 아닌 경우 모두 empty를 반환하여
     * 타인 리소스의 존재 여부가 노출되지 않도록 한다.
     */
    @Query("select s from Scan s join Repository r on r.id = s.repositoryId "
        + "where s.id = :scanId and r.userId = :userId")
    java.util.Optional<Scan> findByIdAndUserId(
        @org.springframework.data.repository.query.Param("scanId") UUID scanId,
        @org.springframework.data.repository.query.Param("userId") UUID userId);

    /** 동일 repo+ref로 진행 중(비종료) 스캔이 있는지 — 중복 스캔 방지(409)에 사용. */
    boolean existsByRepositoryIdAndRefAndStatusIn(UUID repositoryId, String ref, Collection<ScanStatus> statuses);

    /** 특정 상태의 스캔 수 (대시보드 성공률 계산용). */
    long countByStatus(ScanStatus status);

    /** 특정 상태들의 스캔 수. */
    long countByStatusIn(Collection<ScanStatus> statuses);

    /** 완료된 스캔의 평균 소요 시간(ms). 없으면 null. */
    @Query("select avg(s.durationMs) from Scan s where s.durationMs is not null")
    Double averageDurationMs();

    /** 사용자가 소유한 리포에 속한 스캔 수 (마이페이지 통계). */
    @Query("select count(s) from Scan s where s.repositoryId in "
        + "(select r.id from Repository r where r.userId = :userId)")
    long countByUser(UUID userId);
}
