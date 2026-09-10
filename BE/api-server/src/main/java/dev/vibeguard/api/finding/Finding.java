package dev.vibeguard.api.finding;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** findings 테이블 (PRD §10). 스캐너가 발견한 취약점 후보 1건. */
@Entity
@Table(name = "findings")
@Getter
@Setter
@NoArgsConstructor
public class Finding {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "scan_id", nullable = false, columnDefinition = "uuid")
    private UUID scanId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private FindingType type;

    @Column(name = "rule_id")
    private String ruleId;

    @Column(name = "cve_id", length = 64)
    private String cveId;

    @Column(name = "cwe_id", length = 32)
    private String cweId;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private Severity severity;

    @Column(name = "cvss_score", precision = 3, scale = 1)
    private BigDecimal cvssScore;

    @Column(name = "file_path")
    private String filePath;

    @Column(name = "line_start")
    private Integer lineStart;

    @Column(name = "line_end")
    private Integer lineEnd;

    @Column
    private String snippet;

    @Column(name = "package_name")
    private String packageName;

    @Column(name = "current_version", length = 64)
    private String currentVersion;

    @Column(name = "recommended_version", length = 64)
    private String recommendedVersion;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private Verdict verdict;

    @Column
    private String rationale;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private FindingStatus status = FindingStatus.OPEN;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    public Finding(UUID scanId, FindingType type) {
        this.id = UUID.randomUUID();
        this.scanId = scanId;
        this.type = type;
        this.status = FindingStatus.OPEN;
    }
}
