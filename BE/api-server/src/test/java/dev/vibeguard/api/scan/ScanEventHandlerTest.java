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
import dev.vibeguard.api.finding.Verdict;
import dev.vibeguard.api.patch.Patch;
import dev.vibeguard.api.patch.PatchRepository;
import dev.vibeguard.api.patch.PatchSaver;
import dev.vibeguard.api.patch.TestOutcome;
import dev.vibeguard.api.patch.TestPhase;
import dev.vibeguard.api.patch.TestRun;
import dev.vibeguard.api.patch.TestRunSaver;
import dev.vibeguard.api.pr.PullRequest;
import dev.vibeguard.api.pr.PullRequestRepository;
import dev.vibeguard.api.runner.RunnerEvent;
import dev.vibeguard.api.sse.SseHub;
import java.util.HashMap;
import java.util.List;
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
    @Mock PullRequestRepository pullRequestRepository;
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

    // ──────────────────────────────────────────────────────────────────────────
    // VERIFYING DONE — Agent 2 판정 반영
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void VERIFYING_DONE_판정과_권장버전_근거를_Finding에_반영한다() {
        Finding patch = finding("CVE-2026-10001", "next");
        Finding ignore = finding("CVE-2026-10002", "postcss");
        Finding manual = finding("CVE-2026-10003", "sharp");
        lenient().when(findingRepository.findAllByScanId(scanId))
            .thenReturn(List.of(patch, ignore, manual));

        String stageOutput = """
            {"verifiedFindings":[
              {"cveId":"CVE-2026-10001","packageName":"next","verdict":"PATCH",
               "recommendedVersion":"16.2.11","rationale":"동일 major 안전 버전"},
              {"cveId":"CVE-2026-10002","packageName":"postcss","verdict":"IGNORE",
               "rationale":"현재 버전은 영향 범위 아님"},
              {"cveId":"CVE-2026-10003","packageName":"sharp","verdict":"MANUAL",
               "rationale":"lock 파일 수동 검토 필요"}
            ],"patchCandidates":[
              {"packageName":"next","from":"16.2.6","withinMajor":"16.2.11","fixesAll":"16.3.6"}
            ]}
            """;

        handler.handle(stageEvent("VERIFYING", 2, "DONE",
            Map.of("hasOutput", true, "stageOutput", stageOutput)));

        assertThat(patch.getVerdict()).isEqualTo(Verdict.PATCH);
        assertThat(patch.getRecommendedVersion()).isEqualTo("16.2.11");
        assertThat(patch.getRationale()).isEqualTo("동일 major 안전 버전");
        assertThat(ignore.getVerdict()).isEqualTo(Verdict.IGNORE);
        assertThat(manual.getVerdict()).isEqualTo(Verdict.MANUAL);
        verify(findingRepository).saveAll(any());
    }

    @Test
    void VERIFYING_DONE_기존_A2_출력도_PATCH로_호환한다() {
        Finding finding = finding("CVE-2023-32681", "requests");
        lenient().when(findingRepository.findAllByScanId(scanId)).thenReturn(List.of(finding));
        String legacyOutput = """
            {"verifiedFindings":[
              {"id":"CVE-2023-32681","packageName":"requests","withinMajor":"2.31.0","fixesAll":"2.32.4"}
            ],"patchCandidates":[
              {"packageName":"requests","from":"2.28.0","withinMajor":"2.31.0","fixesAll":"2.32.4"}
            ]}
            """;

        handler.handle(stageEvent("VERIFYING", 2, "DONE",
            Map.of("hasOutput", true, "stageOutput", legacyOutput)));

        assertThat(finding.getVerdict()).isEqualTo(Verdict.PATCH);
        assertThat(finding.getRecommendedVersion()).isEqualTo("2.31.0");
        assertThat(finding.getRationale()).contains("공식 advisory");
    }

    @Test
    void VERIFYING_DONE_stageOutput_없으면_Finding을_변경하지_않는다() {
        handler.handle(stageEvent("VERIFYING", 2, "DONE", Map.of("hasOutput", false)));

        verify(findingRepository, never()).findAllByScanId(any());
        verify(findingRepository, never()).saveAll(any());
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

    private Finding finding(String cveId, String packageName) {
        Finding finding = new Finding(scanId, FindingType.SCA);
        finding.setCveId(cveId);
        finding.setPackageName(packageName);
        return finding;
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
        lenient().when(findingRepository.findFirstByScanIdAndPackageNameOrderByIdAsc(eq(scanId), eq("requests")))
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
        lenient().when(findingRepository.findFirstByScanIdAndPackageNameOrderByIdAsc(eq(scanId), eq("requests")))
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

        lenient().when(findingRepository.findFirstByScanIdAndPackageNameOrderByIdAsc(any(), any()))
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
        lenient().when(findingRepository.findFirstByScanIdAndPackageNameOrderByIdAsc(any(), any()))
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
    // PR_CREATING DONE — PullRequest 저장
    // ──────────────────────────────────────────────────────────────────────

    @Test
    void PR_CREATING_DONE_PR_CREATED_PullRequest_저장() {
        String stageOutput = """
            {"outcome":"PR_CREATED",
             "prUrl":"https://github.com/peachoath/vibeguard/pull/50",
             "branch":"vibeguard/patch-test"}
            """;
        lenient().when(pullRequestRepository.findFirstByScanId(scanId))
            .thenReturn(Optional.empty());

        handler.handle(stageEvent("PR_CREATING", 4, "DONE",
            Map.of("hasOutput", true, "stageOutput", stageOutput)));

        ArgumentCaptor<PullRequest> captor = ArgumentCaptor.forClass(PullRequest.class);
        verify(pullRequestRepository).save(captor.capture());
        PullRequest saved = captor.getValue();
        assertThat(saved.getScanId()).isEqualTo(scanId);
        assertThat(saved.getGithubPrNumber()).isEqualTo(50);
        assertThat(saved.getUrl()).isEqualTo("https://github.com/peachoath/vibeguard/pull/50");
        assertThat(saved.getBranchName()).isEqualTo("vibeguard/patch-test");
        assertThat(saved.getState()).isEqualTo("OPEN");
    }

    @Test
    void PR_CREATING_DONE_중복_콜백은_기존_PullRequest_갱신() {
        PullRequest existing = new PullRequest(scanId);
        lenient().when(pullRequestRepository.findFirstByScanId(scanId))
            .thenReturn(Optional.of(existing));
        String stageOutput = """
            {"outcome":"PR_CREATED",
             "prUrl":"https://github.com/peachoath/vibeguard/pull/51",
             "branch":"vibeguard/patch-retry"}
            """;

        handler.handle(stageEvent("PR_CREATING", 4, "DONE",
            Map.of("hasOutput", true, "stageOutput", stageOutput)));

        verify(pullRequestRepository).save(existing);
        assertThat(existing.getGithubPrNumber()).isEqualTo(51);
        assertThat(existing.getBranchName()).isEqualTo("vibeguard/patch-retry");
    }

    @Test
    void PR_CREATING_DONE_SKIPPED면_PullRequest_저장_안함() {
        handler.handle(stageEvent("PR_CREATING", 4, "DONE",
            Map.of("hasOutput", true, "stageOutput", "{\"outcome\":\"SKIPPED\"}")));

        verify(pullRequestRepository, never()).save(any());
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
