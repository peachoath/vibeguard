package dev.vibeguard.api.finding;

import java.math.BigDecimal;
import java.util.UUID;

/** Finding 상세 + 근거 응답 (PRD §9 FindingDetailDto). FindingDto + snippet/rationale. */
public record FindingDetailDto(
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
    String snippet,
    String manifestPath,
    String packageName,
    String currentVersion,
    String recommendedVersion,
    Verdict verdict,
    String rationale,
    FindingStatus status
) {
    public static FindingDetailDto from(Finding f) {
        return new FindingDetailDto(
            f.getId(), f.getType(), f.getRuleId(), f.getCveId(), f.getCweId(),
            f.getSeverity(), f.getCvssScore(), f.getFilePath(), f.getLineStart(), f.getLineEnd(),
            f.getSnippet(), f.getManifestPath(), f.getPackageName(), f.getCurrentVersion(),
            f.getRecommendedVersion(), f.getVerdict(), f.getRationale(), f.getStatus());
    }
}
