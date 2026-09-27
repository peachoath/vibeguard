package dev.vibeguard.api.repository;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** repositories 테이블 (PRD §10). 사용자가 연결한 GitHub 리포지토리. */
@Entity
@Table(name = "repositories")
@Getter
@Setter
@NoArgsConstructor
public class Repository {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Column(name = "github_repo_id", nullable = false)
    private Long githubRepoId;

    @Column(name = "full_name", nullable = false, length = 512)
    private String fullName;

    @Column(name = "default_branch", nullable = false)
    private String defaultBranch;

    @Column(length = 64)
    private String language;

    @Column(name = "connected_at", insertable = false, updatable = false)
    private OffsetDateTime connectedAt;

    public Repository(UUID userId, Long githubRepoId, String fullName, String defaultBranch, String language) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.githubRepoId = githubRepoId;
        this.fullName = fullName;
        this.defaultBranch = defaultBranch;
        this.language = language;
    }
}
