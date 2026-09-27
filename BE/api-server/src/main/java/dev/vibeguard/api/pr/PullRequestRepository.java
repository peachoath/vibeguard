package dev.vibeguard.api.pr;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** pull_requests 테이블 접근. */
public interface PullRequestRepository extends JpaRepository<PullRequest, UUID> {

    List<PullRequest> findByScanId(UUID scanId);
}
