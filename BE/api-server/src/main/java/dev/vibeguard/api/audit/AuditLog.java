package dev.vibeguard.api.audit;

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

/** audit_logs 테이블 (PRD §10, NFR-S7). 모든 에이전트 툴 호출 기록. */
@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
public class AuditLog {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "scan_id", nullable = false, columnDefinition = "uuid")
    private UUID scanId;

    @Column(name = "agent_no")
    private Short agentNo;

    @Column(name = "tool_name")
    private String toolName;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "params_json", columnDefinition = "jsonb")
    private String paramsJson;

    @Column(name = "result_summary")
    private String resultSummary;

    @Column(name = "ts", insertable = false, updatable = false)
    private OffsetDateTime ts;

    public AuditLog(UUID scanId, String toolName) {
        this.id = UUID.randomUUID();
        this.scanId = scanId;
        this.toolName = toolName;
    }
}
