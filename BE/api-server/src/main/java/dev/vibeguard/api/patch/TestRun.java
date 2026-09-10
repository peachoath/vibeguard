package dev.vibeguard.api.patch;

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

/** test_runs 테이블 (PRD §10). 패치별 phase(PRE/POST/REGRESSION) 실행 결과. */
@Entity
@Table(name = "test_runs")
@Getter
@Setter
@NoArgsConstructor
public class TestRun {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "patch_id", nullable = false, columnDefinition = "uuid")
    private UUID patchId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private TestPhase phase;

    @Column(nullable = false)
    private boolean passed;

    @Column
    private Integer total;

    @Column
    private Integer failed;

    @Column
    private String log;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    public TestRun(UUID patchId, TestPhase phase, boolean passed) {
        this.id = UUID.randomUUID();
        this.patchId = patchId;
        this.phase = phase;
        this.passed = passed;
    }
}
