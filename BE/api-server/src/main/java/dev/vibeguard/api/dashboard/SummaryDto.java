package dev.vibeguard.api.dashboard;

import dev.vibeguard.api.finding.Severity;
import java.util.Map;

/** 대시보드 통계 요약 (PRD §9 SummaryDto, F-11). */
public record SummaryDto(
    Map<Severity, Long> severityDistribution,
    double patchSuccessRate,
    Long avgDurationMs,
    long totalScans,
    long totalPrs
) {
}
