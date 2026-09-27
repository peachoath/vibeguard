package dev.vibeguard.api.patch;

import java.time.OffsetDateTime;
import java.util.UUID;

/** GET /api/v1/scans/{id}/test-runs 응답 단건 DTO. */
public record TestRunDto(
    UUID id,
    UUID patchId,
    UUID findingId,
    TestPhase phase,
    boolean passed,
    Integer exitCode,
    TestOutcome outcome,
    Integer total,
    Integer failed,
    Long durationMs,
    String log,
    OffsetDateTime createdAt
) {
    public static TestRunDto from(TestRun tr, UUID findingId) {
        return new TestRunDto(
            tr.getId(),
            tr.getPatchId(),
            findingId,
            tr.getPhase(),
            tr.isPassed(),
            tr.getExitCode(),
            tr.getOutcome(),
            tr.getTotal(),
            tr.getFailed(),
            tr.getDurationMs(),
            tr.getLog(),
            tr.getCreatedAt()
        );
    }
}
