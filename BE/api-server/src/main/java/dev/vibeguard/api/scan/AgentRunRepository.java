package dev.vibeguard.api.scan;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** agent_runs 테이블 접근. */
public interface AgentRunRepository extends JpaRepository<AgentRun, UUID> {

    List<AgentRun> findByScanIdOrderByAgentNo(UUID scanId);
}
