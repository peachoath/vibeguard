package dev.vibeguard.api.pr;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** pull_requests 테이블 접근. */
public interface PullRequestRepository extends JpaRepository<PullRequest, UUID> {

    List<PullRequest> findByScanId(UUID scanId);

    Optional<PullRequest> findFirstByScanId(UUID scanId);

    /** 현재 사용자가 연결한 저장소에서 VibeGuard가 생성한 PR 수. */
    @Query("select count(pr) from PullRequest pr "
        + "join Scan s on s.id = pr.scanId "
        + "join Repository r on r.id = s.repositoryId "
        + "where r.userId = :userId")
    long countByUserId(UUID userId);
}
