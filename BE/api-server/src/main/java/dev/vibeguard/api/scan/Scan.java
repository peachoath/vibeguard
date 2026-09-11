package dev.vibeguard.api.scan;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** scans 테이블 (PRD §10). 한 번의 스캔 파이프라인 실행 단위. */
@Entity
@Table(name = "scans")
@Getter
@Setter
@NoArgsConstructor
public class Scan {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "repository_id", nullable = false, columnDefinition = "uuid")
    private UUID repositoryId;

    @Column(nullable = false)
    private String ref;

    @Column(name = "commit_sha", length = 64)
    private String commitSha;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ScanStatus status = ScanStatus.QUEUED;

    @Column(name = "started_at")
    private OffsetDateTime startedAt;

    @Column(name = "finished_at")
    private OffsetDateTime finishedAt;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "error_code", length = 64)
    private String errorCode;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    public Scan(UUID repositoryId, String ref) {
        this.id = UUID.randomUUID();
        this.repositoryId = repositoryId;
        this.ref = ref;
        this.status = ScanStatus.QUEUED;
    }
}
