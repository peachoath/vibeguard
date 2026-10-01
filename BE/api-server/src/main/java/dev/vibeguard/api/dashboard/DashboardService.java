package dev.vibeguard.api.dashboard;

import dev.vibeguard.api.finding.FindingRepository;
import dev.vibeguard.api.finding.Severity;
import dev.vibeguard.api.scan.AgentRun;
import dev.vibeguard.api.scan.AgentRunRepository;
import dev.vibeguard.api.scan.ScanRepository;
import dev.vibeguard.api.scan.ScanStatus;
import java.time.Duration;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 대시보드 통계 집계 (F-11). */
@Service
public class DashboardService {

    private final FindingRepository findingRepository;
    private final ScanRepository scanRepository;
    private final GeneratedPullRequestCounter generatedPullRequestCounter;
    private final AgentRunRepository agentRunRepository;

    public DashboardService(FindingRepository findingRepository, ScanRepository scanRepository,
                            GeneratedPullRequestCounter generatedPullRequestCounter,
                            AgentRunRepository agentRunRepository) {
        this.findingRepository = findingRepository;
        this.scanRepository = scanRepository;
        this.generatedPullRequestCounter = generatedPullRequestCounter;
        this.agentRunRepository = agentRunRepository;
    }

    @Transactional(readOnly = true)
    public SummaryDto summary(java.util.UUID userId) {
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
        long totalPrs = generatedPullRequestCounter.count();
        StageDurationDto stageAverageDurationMs = stageAverages(
            agentRunRepository.findCompletedByUserId(userId));

        return new SummaryDto(
            distribution, patchSuccessRate, avgDurationMs, stageAverageDurationMs, totalScans, totalPrs);
    }

    private StageDurationDto stageAverages(List<AgentRun> runs) {
        return new StageDurationDto(
            averageForAgent(runs, (short) 1),
            averageForAgent(runs, (short) 2),
            averageForAgent(runs, (short) 3),
            averageForAgent(runs, (short) 4));
    }

    private Long averageForAgent(List<AgentRun> runs, short agentNo) {
        var average = runs.stream()
            .filter(run -> run.getAgentNo() == agentNo)
            .mapToLong(run -> Duration.between(run.getStartedAt(), run.getFinishedAt()).toMillis())
            .filter(duration -> duration >= 0)
            .average();
        return average.isPresent() ? Math.round(average.getAsDouble()) : null;
    }
}
