package dev.vibeguard.api.scan;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** agent_runs 테이블 (PRD §10). Agent 1~4 각 세션의 입출력·토큰 사용량 기록. */
@Entity
@Table(name = "agent_runs")
@Getter
@Setter
@NoArgsConstructor
public class AgentRun {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "scan_id", nullable = false, columnDefinition = "uuid")
    private UUID scanId;

    /** 1~4 (V1__init.sql CHECK 제약). */
    @Column(name = "agent_no", nullable = false)
    private Short agentNo;

    @Column(name = "session_id")
    private String sessionId;

    @Column(nullable = false, length = 32)
    private String status = "PENDING";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "input_json", columnDefinition = "jsonb")
    private String inputJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "output_json", columnDefinition = "jsonb")
    private String outputJson;

    @Column(name = "token_usage")
    private Integer tokenUsage;

    @Column(name = "started_at")
    private OffsetDateTime startedAt;

    @Column(name = "finished_at")
    private OffsetDateTime finishedAt;

    public AgentRun(UUID scanId, Short agentNo) {
        this.id = UUID.randomUUID();
        this.scanId = scanId;
        this.agentNo = agentNo;
        this.status = "PENDING";
    }
}
