package dev.vibeguard.api.scan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyShort;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.vibeguard.api.finding.Finding;
import dev.vibeguard.api.finding.FindingRepository;
import dev.vibeguard.api.finding.FindingSaver;
import dev.vibeguard.api.finding.FindingType;
import dev.vibeguard.api.finding.Severity;
import dev.vibeguard.api.patch.Patch;
import dev.vibeguard.api.patch.PatchRepository;
import dev.vibeguard.api.patch.PatchSaver;
import dev.vibeguard.api.patch.TestOutcome;
import dev.vibeguard.api.patch.TestPhase;
import dev.vibeguard.api.patch.TestRun;
import dev.vibeguard.api.patch.TestRunSaver;
import dev.vibeguard.api.runner.RunnerEvent;
import dev.vibeguard.api.sse.SseHub;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

/** ScanEventHandler 단위 테스트 (DB·Docker 불필요). */
@ExtendWith(MockitoExtension.class)
class ScanEventHandlerTest {

    @Mock ScanService scanService;
    @Mock SseHub sseHub;
    @Mock FindingSaver findingSaver;
    @Mock FindingRepository findingRepository;
    @Mock AgentRunRepository agentRunRepository;
    @Mock PatchRepository patchRepository;
    @Mock PatchSaver patchSaver;
    @Mock TestRunSaver testRunSaver;
    @Spy  ObjectMapper objectMapper;

    @InjectMocks ScanEventHandler handler;

    private final UUID scanId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        lenient().when(agentRunRepository.findByScanIdAndAgentNo(any(), anyShort())).thenReturn(Optional.empty());
        lenient().when(agentRunRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    // ──────────────────────────────────────────────────────────────────────
    // stage 이벤트
    // ──────────────────────────────────────────────────────────────────────

    @Test
    void stage_이벤트는_스캔_상태를_전이하고_SSE를_브로드캐스트한다() {
        RunnerEvent event = stageEvent("SCANNING", 1, "RUNNING", null);

        handler.handle(event);

        verify(scanService).updateStatus(eq(scanId), eq(ScanStatus.SCANNING));
        verify(sseHub).broadcast(eq(scanId), eq("stage"), any());
    }

    @Test
    void stage_이벤트는_AgentRun을_생성한다() {
        RunnerEvent event = stageEvent("SCANNING", 1, "RUNNING", null);

        handler.handle(event);

        ArgumentCaptor<AgentRun> captor = ArgumentCaptor.forClass(AgentRun.class);
        verify(agentRunRepository).save(captor.capture());
        assertThat(captor.getValue().getAgentNo()).isEqualTo((short) 1);
        assertThat(captor.getValue().getStatus()).isEqualTo("RUNNING");
        assertThat(captor.getValue().getStartedAt()).isNotNull();
    }

    // ──────────────────────────────────────────────────────────────────────
    // done 이벤트
    // ──────────────────────────────────────────────────────────────────────

    @Test
    void done_이벤트는_최종_상태를_전이하고_SSE를_완료처리한다() {
        RunnerEvent event = new RunnerEvent(scanId.toString(), "done", null, null, "COMPLETED", null);

        handler.handle(event);

        verify(scanService).updateStatus(eq(scanId), eq(ScanStatus.COMPLETED));
        verify(sseHub).broadcast(eq(scanId), eq("done"), any());
        verify(sseHub).complete(scanId);
    }

    // ──────────────────────────────────────────────────────────────────────
    // finding 이벤트
    // ──────────────────────────────────────────────────────────────────────

    @Test
    void finding_이벤트는_Finding_엔티티를_저장하고_SSE를_브로드캐스트한다() {
        RunnerEvent event = new RunnerEvent(scanId.toString(), "finding", null, null, null, Map.of(
            "cveId", "CVE-2023-32681",
            "packageName", "requests",
            "currentVersion", "2.28.0",
            "recommendedVersion", "2.31.0",
            "severity", "MEDIUM",
            "cvssScore", 6.1,
            "manifestPath", "requirements.txt",
            "filePath", "requirements.txt"
        ));

        handler.handle(event);

        ArgumentCaptor<Finding> captor = ArgumentCaptor.forClass(Finding.class);
        verify(findingSaver).saveIgnoreDuplicate(captor.capture());
        Finding saved = captor.getValue();
        assertThat(saved.getScanId()).isEqualTo(scanId);
        assertThat(saved.getType()).isEqualTo(FindingType.SCA);
        assertThat(saved.getCveId()).isEqualTo("CVE-2023-32681");
        assertThat(saved.getPackageName()).isEqualTo("requests");
        assertThat(saved.getCurrentVersion()).isEqualTo("2.28.0");
        assertThat(saved.getRecommendedVersion()).isEqualTo("2.31.0");
        assertThat(saved.getSeverity()).isEqualTo(Severity.MEDIUM);
        assertThat(saved.getCvssScore()).isNotNull();
        assertThat(saved.getManifestPath()).isEqualTo("requirements.txt");

        verify(sseHub).broadcast(eq(scanId), eq("finding"), any());
    }

    @Test
    void finding_이벤트_payload_없으면_저장_안함() {
        RunnerEvent event = new RunnerEvent(scanId.toString(), "finding", null, null, null, null);

        handler.handle(event);

        verify(findingSaver, never()).saveIgnoreDuplicate(any());
        verify(sseHub, never()).broadcast(any(), any(), any());
    }

    // ──────────────────────────────────────────────────────────────────────
    // REGRESSION_CHECK DONE — Patch·TestRun 저장
    // ──────────────────────────────────────────────────────────────────────

    @Test
    void REGRESSION_CHECK_DONE_stageOutput_없으면_TestRun_저장_안함() {
        RunnerEvent event = stageEvent("REGRESSION_CHECK", 3, "DONE",
            Map.of("hasOutput", true)); // stageOutput 없음

        handler.handle(event);

        verify(testRunSaver, never()).saveIgnoreDuplicate(any());
    }

    @Test
    void REGRESSION_CHECK_DONE_PASSED_Patch와_TestRun_2건_저장() {
        String stageOutput = """
            {"outcome":"PASSED","baseline":"PASSED","postPatch":"PASSED",
             "patches":[{"packageName":"requests","from":"2.28.0","to":"2.31.0","versionStrategy":"withinMajor"}],
             "manifestPath":"requirements.txt"}
            """;

        // FindingRepository 스텁 — scanId+packageName으로 Finding 반환
        Finding mockFinding = new Finding(scanId, FindingType.SCA);
        mockFinding.setPackageName("requests");
        lenient().when(findingRepository.findFirstByScanIdAndPackageName(eq(scanId), eq("requests")))
            .thenReturn(Optional.of(mockFinding));

        // PatchRepository 스텁 — 기존 패치 없음 → 새로 생성
        lenient().when(patchRepository.findFirstByFindingIdOrderByAttemptNoDesc(any()))
            .thenReturn(Optional.empty());
        lenient().when(patchSaver.saveAndReturn(any(Patch.class))).thenAnswer(inv -> inv.getArgument(0));

        RunnerEvent event = stageEvent("REGRESSION_CHECK", 3, "DONE",
            Map.of("hasOutput", true, "stageOutput", stageOutput));

        handler.handle(event);

        // PRE_PATCH + POST_PATCH 2회 저장
        ArgumentCaptor<TestRun> captor = ArgumentCaptor.forClass(TestRun.class);
        verify(testRunSaver, org.mockito.Mockito.times(2)).saveIgnoreDuplicate(captor.capture());

        var saved = captor.getAllValues();
        assertThat(saved).hasSize(2);
        assertThat(saved.get(0).getPhase()).isEqualTo(TestPhase.PRE_PATCH);
        assertThat(saved.get(0).isPassed()).isTrue();
        assertThat(saved.get(0).getOutcome()).isEqualTo(TestOutcome.PASSED);
        assertThat(saved.get(1).getPhase()).isEqualTo(TestPhase.POST_PATCH);
        assertThat(saved.get(1).isPassed()).isTrue();
        assertThat(saved.get(1).getOutcome()).isEqualTo(TestOutcome.PASSED);
    }

    @Test
    void REGRESSION_CHECK_DONE_REGRESSION_BLOCKED_POST_PATCH_FAILED_저장() {
        String stageOutput = """
            {"outcome":"REGRESSION_BLOCKED","baseline":"PASSED","postPatch":"FAILED",
             "patches":[{"packageName":"requests","from":"2.28.0","to":"2.31.0"}]}
            """;

        Finding mockFinding = new Finding(scanId, FindingType.SCA);
        mockFinding.setPackageName("requests");
        lenient().when(findingRepository.findFirstByScanIdAndPackageName(eq(scanId), eq("requests")))
            .thenReturn(Optional.of(mockFinding));
        lenient().when(patchRepository.findFirstByFindingIdOrderByAttemptNoDesc(any()))
            .thenReturn(Optional.empty());
        lenient().when(patchSaver.saveAndReturn(any(Patch.class))).thenAnswer(inv -> inv.getArgument(0));

        RunnerEvent event = stageEvent("REGRESSION_CHECK", 3, "DONE",
            Map.of("hasOutput", true, "stageOutput", stageOutput));

        handler.handle(event);

        ArgumentCaptor<TestRun> captor = ArgumentCaptor.forClass(TestRun.class);
        verify(testRunSaver, org.mockito.Mockito.times(2)).saveIgnoreDuplicate(captor.capture());

        var saved = captor.getAllValues();
        assertThat(saved.get(0).getPhase()).isEqualTo(TestPhase.PRE_PATCH);
        assertThat(saved.get(0).isPassed()).isTrue();
        assertThat(saved.get(1).getPhase()).isEqualTo(TestPhase.POST_PATCH);
        assertThat(saved.get(1).isPassed()).isFalse();
        assertThat(saved.get(1).getOutcome()).isEqualTo(TestOutcome.FAILED);
    }

    @Test
    void REGRESSION_CHECK_DONE_존재하지_않는_packageName_스킵() {
        String stageOutput = """
            {"outcome":"PASSED","baseline":"PASSED","postPatch":"PASSED",
             "patches":[{"packageName":"unknown-pkg","from":"1.0.0","to":"2.0.0"}]}
            """;

        lenient().when(findingRepository.findFirstByScanIdAndPackageName(any(), any()))
            .thenReturn(Optional.empty());

        RunnerEvent event = stageEvent("REGRESSION_CHECK", 3, "DONE",
            Map.of("hasOutput", true, "stageOutput", stageOutput));

        handler.handle(event);

        // Finding 없으므로 TestRun 저장 안 함
        verify(testRunSaver, never()).saveIgnoreDuplicate(any());
    }

    @Test
    void REGRESSION_CHECK_DONE_기존_Patch_있으면_재사용() {
        String stageOutput = """
            {"outcome":"PASSED","baseline":"PASSED","postPatch":"PASSED",
             "patches":[{"packageName":"requests","from":"2.28.0","to":"2.31.0"}]}
            """;

        Finding mockFinding = new Finding(scanId, FindingType.SCA);
        mockFinding.setPackageName("requests");
        lenient().when(findingRepository.findFirstByScanIdAndPackageName(any(), any()))
            .thenReturn(Optional.of(mockFinding));

        // 기존 패치 존재
        Patch existingPatch = new Patch(mockFinding.getId());
        lenient().when(patchRepository.findFirstByFindingIdOrderByAttemptNoDesc(any()))
            .thenReturn(Optional.of(existingPatch));

        RunnerEvent event = stageEvent("REGRESSION_CHECK", 3, "DONE",
            Map.of("hasOutput", true, "stageOutput", stageOutput));

        handler.handle(event);

        // 새 Patch 생성 없이 TestRun만 2건 저장
        verify(patchSaver, never()).saveAndReturn(any());
        verify(testRunSaver, org.mockito.Mockito.times(2)).saveIgnoreDuplicate(any());
    }

    @Test
    void REGRESSION_CHECK_DONE_잘못된_JSON_무시() {
        RunnerEvent event = stageEvent("REGRESSION_CHECK", 3, "DONE",
            Map.of("hasOutput", true, "stageOutput", "not-json"));

        handler.handle(event);

        verify(testRunSaver, never()).saveIgnoreDuplicate(any());
    }

    // ──────────────────────────────────────────────────────────────────────
    // 보안 경계
    // ──────────────────────────────────────────────────────────────────────

    @Test
    void 알수없는_scanId는_무시한다() {
        RunnerEvent event = new RunnerEvent("not-a-uuid", "stage", "SCANNING", 1, "RUNNING", null);

        handler.handle(event);

        verify(scanService, never()).updateStatus(any(), any());
    }

    @Test
    void 알수없는_kind는_무시한다() {
        RunnerEvent event = new RunnerEvent(scanId.toString(), "unknown", null, null, null, null);

        handler.handle(event);

        verify(scanService, never()).updateStatus(any(), any());
        verify(findingSaver, never()).saveIgnoreDuplicate(any());
    }

    // ──────────────────────────────────────────────────────────────────────
    // 헬퍼
    // ──────────────────────────────────────────────────────────────────────

    private RunnerEvent stageEvent(String stage, int agent, String status,
                                   Map<String, Object> payload) {
        Map<String, Object> p = payload != null ? new HashMap<>(payload) : null;
        return new RunnerEvent(scanId.toString(), "stage", stage, agent, status, p);
    }
}
