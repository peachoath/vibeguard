package dev.vibeguard.api.dashboard;

import java.util.List;

/**
 * GET /api/v1/stats 응답 DTO.
 * FE DashboardPage 에서 사용하는 통계 형태.
 */
public record StatsDto(
    long totalScans,
    double successRate,
    long totalFindings,
    long fixedFindings,
    List<TrendPoint> trend
) {
    public record TrendPoint(String date, long scans, long findings) {}
}
