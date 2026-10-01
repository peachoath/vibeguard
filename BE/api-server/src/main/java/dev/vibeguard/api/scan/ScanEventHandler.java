package dev.vibeguard.api.scan;

import com.fasterxml.jackson.core.type.TypeReference;
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
import dev.vibeguard.api.pr.PullRequest;
import dev.vibeguard.api.pr.PullRequestRepository;
import dev.vibeguard.api.runner.RunnerEvent;
import dev.vibeguard.api.runner.RunnerEventHandler;
import dev.vibeguard.api.sse.SseHub;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 런너 콜백 이벤트를 스캔 상태머신에 반영하고(PRD §6.1) SSE로 브로드캐스트한다(F-04).
 * kind=stage → 단계 상태 전이 + AgentRun 갱신 + REGRESSION_CHECK DONE 시 Patch·TestRun 저장.
 * kind=finding → findings 테이블 저장 후 SSE 전달(중복은 유니크 인덱스로 멱등 처리).
 * kind=done → 최종 상태 반영 후 스트림 종료.
 * kind=log → SSE 전달만(저장 불필요, audit_logs는 런너가 직접 기록).
 */
@Component
public class ScanEventHandler implements RunnerEventHandler {

    private static final Logger log = LoggerFactory.getLogger(ScanEventHandler.class);
    private static final int LOG_MAX_CHARS = 8_000;
    private static final Pattern GITHUB_PR_URL = Pattern.compile("/pull/(\\d+)(?:/)?$");

    private final ScanService scanService;
    private final SseHub sseHub;
    private final FindingSaver findingSaver;
    private final FindingRepository findingRepository;
    private final AgentRunRepository agentRunRepository;
    private final PatchRepository patchRepository;
    private final PatchSaver patchSaver;
    private final TestRunSaver testRunSaver;
    private final PullRequestRepository pullRequestRepository;
    private final ObjectMapper objectMapper;

    public ScanEventHandler(ScanService scanService, SseHub sseHub,
                            FindingSaver findingSaver, FindingRepository findingRepository,
                            AgentRunRepository agentRunRepository,
                            PatchRepository patchRepository, PatchSaver patchSaver,
                            TestRunSaver testRunSaver,
                            PullRequestRepository pullRequestRepository,
                            ObjectMapper objectMapper) {
        this.scanService = scanService;
        this.sseHub = sseHub;
        this.findingSaver = findingSaver;
        this.findingRepository = findingRepository;
        this.agentRunRepository = agentRunRepository;
        this.patchRepository = patchRepository;
        this.patchSaver = patchSaver;
        this.testRunSaver = testRunSaver;
        this.pullRequestRepository = pullRequestRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional
    public void handle(RunnerEvent event) {
        UUID scanId = parseScanId(event.scanId());
        if (scanId == null) {
            log.warn("[scan-event] 유효하지 않은 scanId: {}", event.scanId());
            return;
        }

        String kind = event.kind() == null ? "" : event.kind();
        switch (kind) {
            case "stage" -> handleStage(scanId, event);
            case "done" -> handleDone(scanId, event);
            case "log" -> sseHub.broadcast(scanId, kind, toPayload(event));
            case "finding" -> handleFinding(scanId, event);
            default -> log.debug("[scan-event] 처리하지 않는 kind={} scanId={}", kind, scanId);
        }
    }

    private void handleStage(UUID scanId, RunnerEvent event) {
        ScanStatus status = toStatus(event.stage());
        if (status == null) {
            log.warn("[scan-event] 매핑 불가한 stage={} scanId={}", event.stage(), scanId);
            return;
        }
        scanService.updateStatus(scanId, status);

        // AgentRun 상태 갱신 — agent 번호가 유효한 단계(A1~A4)에서만
        if (event.agent() != null && event.agent() >= 1 && event.agent() <= 4) {
            upsertAgentRun(scanId, event.agent().shortValue(), event.status());
        }

        // A3(REGRESSION_CHECK) DONE → Patch·TestRun 영속화
        if ("REGRESSION_CHECK".equalsIgnoreCase(event.stage())
                && "DONE".equalsIgnoreCase(event.status())) {
            handleRegressionCheckDone(scanId, event);
        }

        // A4(PR_CREATING) DONE → Agent가 실제 생성한 PR 정보를 멱등 저장한다.
        if ("PR_CREATING".equalsIgnoreCase(event.stage())
                && "DONE".equalsIgnoreCase(event.status())) {
            handlePullRequestCreatingDone(scanId, event);
        }

        sseHub.broadcast(scanId, "stage", toPayload(event));
    }

    private void handleDone(UUID scanId, RunnerEvent event) {
        ScanStatus status = toStatus(event.status());
        if (status == null) {
            log.warn("[scan-event] done 이벤트 status 매핑 불가={} scanId={}", event.status(), scanId);
            return;
        }
        scanService.updateStatus(scanId, status);
        sseHub.broadcast(scanId, "done", toPayload(event));
        sseHub.complete(scanId);
    }

    /**
     * finding 이벤트 → DB 저장 후 SSE 브로드캐스트.
     * FindingSaver(REQUIRES_NEW)가 중복 시 해당 트랜잭션만 롤백 — 외부 트랜잭션 오염 방지.
     */
    private void handleFinding(UUID scanId, RunnerEvent event) {
        if (event.payload() == null) {
            log.warn("[scan-event] finding 페이로드 없음 scanId={}", scanId);
            return;
        }
        Finding finding = buildFinding(scanId, event.payload());
        findingSaver.saveIgnoreDuplicate(finding);
        sseHub.broadcast(scanId, "finding", toPayload(event));
    }

    /**
     * REGRESSION_CHECK DONE 이벤트 처리.
     * payload.stageOutput(A3 에이전트 JSON 문자열)을 파싱해 Patch·TestRun을 DB에 저장한다.
     *
     * <p>A3 에이전트 출력 예시:
     * <pre>{
     *   "outcome": "PASSED",
     *   "baseline": "PASSED",   // PRE_PATCH 테스트 결과
     *   "postPatch": "PASSED",  // POST_PATCH 테스트 결과
     *   "patches": [{ "packageName": "requests", "from": "2.28.0", "to": "2.31.0", "versionStrategy": "withinMajor" }],
     *   "manifestPath": "requirements.txt"
     * }</pre>
     *
     * <p>잘못된 페이로드나 찾을 수 없는 Finding은 로그만 남기고 건너뛴다(전체 파이프라인 중단 없음).
     */
    @SuppressWarnings("unchecked")
    private void handleRegressionCheckDone(UUID scanId, RunnerEvent event) {
        if (event.payload() == null) return;

        Object raw = event.payload().get("stageOutput");
        if (raw == null) {
            log.debug("[scan-event] REGRESSION_CHECK DONE stageOutput 없음 scanId={}", scanId);
            return;
        }

        Map<String, Object> a3;
        try {
            // A3 에이전트가 JSON을 마크다운 코드펜스로 감쌀 수 있다 — 벗겨낸다
            String jsonStr = stripMarkdownFences(raw.toString());
            a3 = objectMapper.readValue(jsonStr,
                new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("[scan-event] REGRESSION_CHECK stageOutput JSON 파싱 실패 scanId={}: {}", scanId, e.getMessage());
            return;
        }

        List<Map<String, Object>> patches;
        try {
            Object patchesRaw = a3.get("patches");
            if (!(patchesRaw instanceof List<?> list) || list.isEmpty()) {
                log.debug("[scan-event] REGRESSION_CHECK patches 없음 scanId={}", scanId);
                return;
            }
            patches = (List<Map<String, Object>>) list;
        } catch (ClassCastException e) {
            log.warn("[scan-event] REGRESSION_CHECK patches 형식 오류 scanId={}", scanId);
            return;
        }

        String baseline = str(a3, "baseline");
        String postPatch = str(a3, "postPatch");

        for (Map<String, Object> patchData : patches) {
            String packageName = str(patchData, "packageName");
            if (packageName == null || packageName.isBlank()) {
                log.warn("[scan-event] packageName 없는 patch 항목 scanId={}", scanId);
                continue;
            }

            // Finding 조회 — scanId + packageName
            var findingOpt = findingRepository.findFirstByScanIdAndPackageNameOrderByIdAsc(scanId, packageName);
            if (findingOpt.isEmpty()) {
                log.warn("[scan-event] Finding 없음 scanId={} packageName={}", scanId, packageName);
                continue;
            }
            UUID findingId = findingOpt.get().getId();

            // Patch 생성 또는 재사용.
            // 새 Patch는 PatchSaver(REQUIRES_NEW)로 즉시 커밋 — TestRunSaver가 FK를 참조하기 전에 반드시 커밋되어야 함.
            Patch patch = patchRepository.findFirstByFindingIdOrderByAttemptNoDesc(findingId)
                .orElseGet(() -> createPatch(findingId, patchData));

            // PRE_PATCH TestRun
            if (baseline != null) {
                TestRun prePatch = buildTestRun(patch.getId(), TestPhase.PRE_PATCH, baseline, null);
                testRunSaver.saveIgnoreDuplicate(prePatch);
            }

            // POST_PATCH TestRun
            if (postPatch != null) {
                TestRun postPatchRun = buildTestRun(patch.getId(), TestPhase.POST_PATCH, postPatch, null);
                testRunSaver.saveIgnoreDuplicate(postPatchRun);
            }

            log.debug("[scan-event] Patch·TestRun 저장 scanId={} findingId={} baseline={} postPatch={}",
                scanId, findingId, baseline, postPatch);
        }
    }

    /**
     * PR_CREATING DONE 이벤트의 A4 JSON 결과를 pull_requests에 저장한다.
     * 동일 콜백이 재전송돼도 scan_id 기준으로 기존 행을 갱신해 대시보드 건수가 중복되지 않는다.
     */
    private void handlePullRequestCreatingDone(UUID scanId, RunnerEvent event) {
        if (event.payload() == null) return;

        Object raw = event.payload().get("stageOutput");
        if (raw == null) {
            log.debug("[scan-event] PR_CREATING DONE stageOutput 없음 scanId={}", scanId);
            return;
        }

        Map<String, Object> a4;
        try {
            a4 = objectMapper.readValue(stripMarkdownFences(raw.toString()),
                new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("[scan-event] PR_CREATING stageOutput JSON 파싱 실패 scanId={}: {}", scanId, e.getMessage());
            return;
        }

        if (!"PR_CREATED".equalsIgnoreCase(str(a4, "outcome"))) {
            log.debug("[scan-event] PR 생성 결과 아님 scanId={} outcome={}", scanId, str(a4, "outcome"));
            return;
        }

        String prUrl = str(a4, "prUrl");
        if (prUrl == null || prUrl.isBlank()) {
            log.warn("[scan-event] PR_CREATED이나 prUrl 없음 scanId={}", scanId);
            return;
        }

        PullRequest pullRequest = pullRequestRepository.findFirstByScanId(scanId)
            .orElseGet(() -> new PullRequest(scanId));
        pullRequest.setUrl(prUrl);
        pullRequest.setBranchName(str(a4, "branch"));
        pullRequest.setGithubPrNumber(parseGithubPrNumber(prUrl));
        pullRequest.setState("OPEN");
        pullRequestRepository.save(pullRequest);
    }

    private Integer parseGithubPrNumber(String prUrl) {
        Matcher matcher = GITHUB_PR_URL.matcher(prUrl);
        if (!matcher.find()) return null;
        try {
            return Integer.valueOf(matcher.group(1));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private Patch createPatch(UUID findingId, Map<String, Object> patchData) {
        Patch p = new Patch(findingId);
        p.setStrategy(str(patchData, "versionStrategy"));
        String from = str(patchData, "from");
        String to = str(patchData, "to");
        String pkg = str(patchData, "packageName");
        if (from != null && to != null && pkg != null) {
            p.setDiff(String.format("-%s==%s\n+%s==%s", pkg, from, pkg, to));
        }
        return patchSaver.saveAndReturn(p);
    }

    private TestRun buildTestRun(UUID patchId, TestPhase phase, String outcomeStr, String logText) {
        TestOutcome outcome = toTestOutcome(outcomeStr);
        boolean passed = outcome == TestOutcome.PASSED;
        TestRun tr = new TestRun(patchId, phase, passed);
        tr.setOutcome(outcome);
        if (logText != null) {
            tr.setLog(logText.length() > LOG_MAX_CHARS
                ? logText.substring(0, LOG_MAX_CHARS) + "…(잘림)" : logText);
        }
        return tr;
    }

    /** A3 outcome/baseline/postPatch 문자열 → TestOutcome. 알 수 없는 값은 FAILED. */
    private TestOutcome toTestOutcome(String raw) {
        if (raw == null) return TestOutcome.FAILED;
        return switch (raw.toUpperCase()) {
            case "PASSED", "OK" -> TestOutcome.PASSED;
            case "NO_TESTS" -> TestOutcome.NO_TESTS;
            case "OOM_KILLED" -> TestOutcome.OOM_KILLED;
            case "TIMED_OUT" -> TestOutcome.TIMED_OUT;
            case "INSTALL_FAILED" -> TestOutcome.INSTALL_FAILED;
            default -> TestOutcome.FAILED;
        };
    }

    /** payload Map → Finding 엔티티. 타입은 SCA 고정(MVP, V2__sca_alignment). */
    private Finding buildFinding(UUID scanId, Map<String, Object> p) {
        Finding f = new Finding(scanId, FindingType.SCA);
        f.setRuleId(str(p, "ruleId"));
        f.setCveId(str(p, "cveId"));
        f.setCweId(str(p, "cweId"));
        f.setFilePath(str(p, "filePath"));
        f.setManifestPath(str(p, "manifestPath"));
        f.setPackageName(str(p, "packageName"));
        f.setCurrentVersion(str(p, "currentVersion"));
        f.setRecommendedVersion(str(p, "recommendedVersion"));
        f.setSnippet(str(p, "snippet"));

        String severityRaw = str(p, "severity");
        if (severityRaw != null) {
            try {
                f.setSeverity(Severity.valueOf(severityRaw.toUpperCase()));
            } catch (IllegalArgumentException ignored) { }
        }

        Object cvss = p.get("cvssScore");
        if (cvss != null) {
            try {
                f.setCvssScore(new BigDecimal(cvss.toString()));
            } catch (NumberFormatException ignored) { }
        }

        Object lineStart = p.get("lineStart");
        if (lineStart instanceof Number n) f.setLineStart(n.intValue());

        Object lineEnd = p.get("lineEnd");
        if (lineEnd instanceof Number n) f.setLineEnd(n.intValue());

        return f;
    }

    /** AgentRun 상태 갱신 — 없으면 생성, 있으면 status·타임스탬프 업데이트. */
    private void upsertAgentRun(UUID scanId, short agentNo, String stageStatus) {
        AgentRun run = agentRunRepository
            .findByScanIdAndAgentNo(scanId, agentNo)
            .orElseGet(() -> new AgentRun(scanId, agentNo));

        if ("RUNNING".equalsIgnoreCase(stageStatus)) {
            run.setStatus("RUNNING");
            run.setStartedAt(OffsetDateTime.now());
        } else if ("DONE".equalsIgnoreCase(stageStatus)) {
            run.setStatus("COMPLETED");
            run.setFinishedAt(OffsetDateTime.now());
        }
        agentRunRepository.save(run);
    }

    private Map<String, Object> toPayload(RunnerEvent event) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("scanId", event.scanId());
        m.put("kind", event.kind());
        if (event.stage() != null) m.put("stage", event.stage());
        if (event.agent() != null) m.put("agent", event.agent());
        if (event.status() != null) m.put("status", event.status());
        if (event.payload() != null) m.put("payload", event.payload());
        return m;
    }

    private ScanStatus toStatus(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return ScanStatus.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private UUID parseScanId(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private String str(Map<String, Object> m, String key) {
        Object v = m.get(key);
        return v == null ? null : v.toString();
    }

    /** 에이전트 출력이 ```json ... ``` 마크다운 코드펜스에 감싸인 경우 벗긴다. */
    private String stripMarkdownFences(String raw) {
        if (raw == null) return raw;
        String trimmed = raw.strip();
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            int lastFence = trimmed.lastIndexOf("```");
            if (firstNewline > 0 && lastFence > firstNewline) {
                return trimmed.substring(firstNewline + 1, lastFence).strip();
            }
        }
        return trimmed;
    }
}
