package dev.vibeguard.api.scan;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** agent_runs 테이블 접근. */
public interface AgentRunRepository extends JpaRepository<AgentRun, UUID> {

    List<AgentRun> findByScanIdOrderByAgentNo(UUID scanId);

    java.util.Optional<AgentRun> findByScanIdAndAgentNo(UUID scanId, short agentNo);

    /** 현재 사용자의 완료된 에이전트 실행 기록. 대시보드 단계별 처리 시간 집계용. */
    @Query("select ar from AgentRun ar where ar.startedAt is not null and ar.finishedAt is not null "
        + "and ar.scanId in (select s.id from Scan s where s.repositoryId in "
        + "(select r.id from Repository r where r.userId = :userId))")
    List<AgentRun> findCompletedByUserId(UUID userId);
}
