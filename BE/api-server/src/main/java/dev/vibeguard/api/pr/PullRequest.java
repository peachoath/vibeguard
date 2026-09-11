package dev.vibeguard.api.pr;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** pull_requests 테이블 (PRD §10). Agent 4가 생성한 PR 정보. */
@Entity
@Table(name = "pull_requests")
@Getter
@Setter
@NoArgsConstructor
public class PullRequest {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "scan_id", nullable = false, columnDefinition = "uuid")
    private UUID scanId;

    @Column(name = "github_pr_number")
    private Integer githubPrNumber;

    @Column
    private String url;

    @Column(name = "branch_name")
    private String branchName;

    @Column(length = 32)
    private String state;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    public PullRequest(UUID scanId) {
        this.id = UUID.randomUUID();
        this.scanId = scanId;
    }
}
