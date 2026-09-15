package dev.vibeguard.api.dashboard;

import dev.vibeguard.api.finding.FindingRepository;
import dev.vibeguard.api.finding.FindingStatus;
import dev.vibeguard.api.finding.Severity;
import dev.vibeguard.api.pr.PullRequestRepository;
import dev.vibeguard.api.scan.Scan;
import dev.vibeguard.api.scan.ScanRepository;
import dev.vibeguard.api.scan.ScanStatus;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 대시보드 통계 집계 (F-11). */
@Service
public class DashboardService {

    private final FindingRepository findingRepository;
    private final ScanRepository scanRepository;
    private final PullRequestRepository pullRequestRepository;

    public DashboardService(FindingRepository findingRepository, ScanRepository scanRepository,
                            PullRequestRepository pullRequestRepository) {
        this.findingRepository = findingRepository;
        this.scanRepository = scanRepository;
        this.pullRequestRepository = pullRequestRepository;
    }

    @Transactional(readOnly = true)
    public SummaryDto summary() {
        // 심각도 분포 (severity가 null인 Finding은 제외)
        Map<Severity, Long> distribution = new EnumMap<>(Severity.class);
        for (Severity s : Severity.values()) {
            distribution.put(s, 0L);
        }
        for (Object[] row : findingRepository.countBySeverity()) {
            Severity sev = (Severity) row[0];
            Long count = (Long) row[1];
            if (sev != null) {
                distribution.put(sev, count);
            }
        }

        // 패치 성공률 = COMPLETED / (패치 시도가 종료된 스캔: COMPLETED + PATCH_FAILED + REGRESSION_BLOCKED)
        long completed = scanRepository.countByStatus(ScanStatus.COMPLETED);
        long patchAttemptTerminal = scanRepository.countByStatusIn(List.of(
            ScanStatus.COMPLETED, ScanStatus.PATCH_FAILED, ScanStatus.REGRESSION_BLOCKED));
        double patchSuccessRate = patchAttemptTerminal == 0
            ? 0.0
            : (double) completed / patchAttemptTerminal;

        Double avg = scanRepository.averageDurationMs();
        Long avgDurationMs = avg == null ? null : Math.round(avg);

        long totalScans = scanRepository.count();
        long totalPrs = pullRequestRepository.count();

        return new SummaryDto(distribution, patchSuccessRate, avgDurationMs, totalScans, totalPrs);
    }

    /** GET /api/v1/stats — FE 대시보드 통계. */
    @Transactional(readOnly = true)
    public StatsDto stats() {
        long totalScans = scanRepository.count();

        // 성공률: COMPLETED / (COMPLETED + PATCH_FAILED + REGRESSION_BLOCKED)
        long completed         = scanRepository.countByStatus(ScanStatus.COMPLETED);
        long patchTerminal     = scanRepository.countByStatusIn(List.of(
            ScanStatus.COMPLETED, ScanStatus.PATCH_FAILED, ScanStatus.REGRESSION_BLOCKED));
        double successRate     = patchTerminal == 0 ? 0.0 : (double) completed / patchTerminal;

        long totalFindings = findingRepository.count();
        long fixedFindings = findingRepository.countByStatus(FindingStatus.PATCHED);

        // 최근 7일 트렌드 — 날짜별 스캔 수 집계 (findings는 finding 영속화 후 추가 예정)
        OffsetDateTime since     = OffsetDateTime.now().minusDays(6).toLocalDate().atStartOfDay()
            .atOffset(OffsetDateTime.now().getOffset());
        List<Scan> recentScans   = scanRepository.findByStartedAtAfter(since);
        Map<LocalDate, Long> scansByDate = recentScans.stream()
            .filter(s -> s.getStartedAt() != null)
            .collect(Collectors.groupingBy(
                s -> s.getStartedAt().toLocalDate(),
                Collectors.counting()
            ));

        List<StatsDto.TrendPoint> trend = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate date = LocalDate.now().minusDays(i);
            trend.add(new StatsDto.TrendPoint(
                date.toString(),
                scansByDate.getOrDefault(date, 0L),
                0L  // finding 영속화 구현 후 채워질 예정
            ));
        }

        return new StatsDto(totalScans, successRate, totalFindings, fixedFindings, trend);
    }
}
