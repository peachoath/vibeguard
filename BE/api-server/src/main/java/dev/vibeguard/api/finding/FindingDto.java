package dev.vibeguard.api.finding;

import java.math.BigDecimal;
import java.util.UUID;

/** Finding 목록 응답 (PRD §9 FindingDto). */
public record FindingDto(
    UUID id,
    FindingType type,
    String ruleId,
    String cveId,
    String cweId,
    Severity severity,
    BigDecimal cvssScore,
    String filePath,
    Integer lineStart,
    Integer lineEnd,
    String packageName,
    String currentVersion,
    String recommendedVersion,
    Verdict verdict,
    FindingStatus status
) {
    public static FindingDto from(Finding f) {
        return new FindingDto(
            f.getId(), f.getType(), f.getRuleId(), f.getCveId(), f.getCweId(),
            f.getSeverity(), f.getCvssScore(), f.getFilePath(), f.getLineStart(), f.getLineEnd(),
            f.getPackageName(), f.getCurrentVersion(), f.getRecommendedVersion(),
            f.getVerdict(), f.getStatus());
    }
}
