package dev.vibeguard.api.scan;

import java.time.OffsetDateTime;
import java.util.UUID;

/** 스캔 응답 (PRD §9 ScanDto). */
public record ScanDto(
    UUID id,
    UUID repositoryId,
    String ref,
    String commitSha,
    ScanStatus status,
    OffsetDateTime startedAt,
    OffsetDateTime finishedAt,
    Long durationMs,
    String errorCode
) {
    public static ScanDto from(Scan scan) {
        return new ScanDto(
            scan.getId(),
            scan.getRepositoryId(),
            scan.getRef(),
            scan.getCommitSha(),
            scan.getStatus(),
            scan.getStartedAt(),
            scan.getFinishedAt(),
            scan.getDurationMs(),
            scan.getErrorCode());
    }
}
