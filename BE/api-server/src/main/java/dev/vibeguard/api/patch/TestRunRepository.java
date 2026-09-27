package dev.vibeguard.api.patch;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** test_runs 테이블 접근. */
public interface TestRunRepository extends JpaRepository<TestRun, UUID> {

    List<TestRun> findByPatchIdOrderByCreatedAt(UUID patchId);

    /** phase 단건 조회 — 멱등성 확인(uq_testrun_patch_phase와 쌍). */
    Optional<TestRun> findByPatchIdAndPhase(UUID patchId, TestPhase phase);

    /**
     * 스캔에 속한 모든 TestRun 조회 — GET /scans/{id}/test-runs 전용.
     * findings → patches → test_runs 경로로 조인하고, 소유권은 scan → repository → user 로 확인.
     */
    @Query("""
        select tr from TestRun tr
        join Patch p  on p.id  = tr.patchId
        join Finding f on f.id  = p.findingId
        join Scan s    on s.id  = f.scanId
        join Repository r on r.id = s.repositoryId
        where f.scanId = :scanId and r.userId = :userId
        order by tr.createdAt asc
        """)
    List<TestRun> findByScanIdAndUserId(
        @Param("scanId") UUID scanId,
        @Param("userId") UUID userId);
}
