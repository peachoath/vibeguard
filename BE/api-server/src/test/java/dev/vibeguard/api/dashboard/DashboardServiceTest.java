package dev.vibeguard.api.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import dev.vibeguard.api.finding.FindingRepository;
import dev.vibeguard.api.scan.AgentRun;
import dev.vibeguard.api.scan.AgentRunRepository;
import dev.vibeguard.api.scan.ScanRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock FindingRepository findingRepository;
    @Mock ScanRepository scanRepository;
    @Mock GeneratedPullRequestCounter generatedPullRequestCounter;
    @Mock AgentRunRepository agentRunRepository;
    @InjectMocks DashboardService dashboardService;

    @Test
    void 단계별_완료_시간을_에이전트별_평균으로_집계한다() {
        UUID userId = UUID.randomUUID();
        when(findingRepository.countBySeverity()).thenReturn(List.of());
        when(agentRunRepository.findCompletedByUserId(userId)).thenReturn(List.of(
            run((short) 1, 1_000),
            run((short) 1, 3_000),
            run((short) 2, 4_000),
            run((short) 3, 5_000)));

        StageDurationDto durations = dashboardService.summary(userId).stageAverageDurationMs();

        assertThat(durations.scanMs()).isEqualTo(2_000);
        assertThat(durations.verificationMs()).isEqualTo(4_000);
        assertThat(durations.regressionMs()).isEqualTo(5_000);
        assertThat(durations.pullRequestMs()).isNull();
    }

    private AgentRun run(short agentNo, long durationMs) {
        OffsetDateTime startedAt = OffsetDateTime.parse("2026-10-01T00:00:00Z");
        AgentRun run = new AgentRun(UUID.randomUUID(), agentNo);
        run.setStartedAt(startedAt);
        run.setFinishedAt(startedAt.plusNanos(durationMs * 1_000_000));
        return run;
    }
}
