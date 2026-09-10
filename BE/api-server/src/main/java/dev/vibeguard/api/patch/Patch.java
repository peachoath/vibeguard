package dev.vibeguard.api.patch;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** patches 테이블 (PRD §10, 방향 전환 v2). Finding 1건에 대한 패치(매니페스트 버전 상향 diff). */
@Entity
@Table(name = "patches")
@Getter
@Setter
@NoArgsConstructor
public class Patch {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "finding_id", nullable = false, columnDefinition = "uuid")
    private UUID findingId;

    @Column
    private String diff;

    @Column
    private String strategy;

    @Column(name = "attempt_no", nullable = false)
    private Short attemptNo = 1;

    @Column(nullable = false, length = 32)
    private String status = "PENDING";

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    public Patch(UUID findingId) {
        this.id = UUID.randomUUID();
        this.findingId = findingId;
        this.attemptNo = 1;
        this.status = "PENDING";
    }
}
