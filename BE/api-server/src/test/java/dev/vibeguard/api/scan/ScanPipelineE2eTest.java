package dev.vibeguard.api.scan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.vibeguard.api.TestcontainersConfiguration;
import dev.vibeguard.api.auth.CurrentUserService;
import dev.vibeguard.api.finding.Finding;
import dev.vibeguard.api.finding.FindingRepository;
import dev.vibeguard.api.patch.PatchRepository;
import dev.vibeguard.api.patch.TestPhase;
import dev.vibeguard.api.patch.TestRunRepository;
import dev.vibeguard.api.repository.Repositories;
import dev.vibeguard.api.repository.Repository;
import dev.vibeguard.api.runner.HmacSigner;
import dev.vibeguard.api.runner.RunnerClient;
import dev.vibeguard.api.security.TokenCipher;
import dev.vibeguard.api.user.User;
import dev.vibeguard.api.user.UserRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * 스캔 파이프라인 E2E 통합 테스트 (Testcontainers PostgreSQL 16).
 *
 * <p>검증 범위:
 * <ol>
 *   <li>POST /scans → 202 + RunnerClient.delegateScan() 호출</li>
 *   <li>HMAC 서명 콜백 → stage 이벤트 → ScanStatus 전이</li>
 *   <li>finding 콜백 → findings 테이블 INSERT (CVE·패키지·버전·심각도 포함)</li>
 *   <li>중복 finding 콜백 → 멱등성 보장 (유니크 인덱스 위반 조용히 무시)</li>
 *   <li>done 콜백 → ScanStatus=COMPLETED + finishedAt 기록</li>
 *   <li>GET /scans/{id}/findings → DB 저장 데이터 반환</li>
 * </ol>
 *
 * <p>실행 요건: Docker (PostgreSQL 16 Testcontainer).
 * RunnerClient는 @MockitoBean으로 교체해 실제 Node 런너 없이 실행한다.
 */
@SpringBootTest(webEnvironment = WebEnvironment.MOCK)
@org.springframework.test.context.ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class ScanPipelineE2eTest {

    @Autowired WebApplicationContext wac;
    @Autowired ObjectMapper objectMapper;
    @Autowired HmacSigner hmacSigner;

    @Autowired UserRepository userRepository;
    @Autowired Repositories repositories;
    @Autowired ScanRepository scanRepository;
    @Autowired FindingRepository findingRepository;
    @Autowired PatchRepository patchRepository;
    @Autowired TestRunRepository testRunRepository;

    /** RunnerClient를 교체 — 실제 Node 런너 HTTP 호출 방지. */
    @MockitoBean RunnerClient runnerClient;
    /** CurrentUserService를 교체 — OAuth2 GitHub 인증 없이 테스트 사용자 반환. */
    @MockitoBean CurrentUserService currentUserService;
    /** TokenCipher를 교체 — 테스트용 enc-token 복호화. */
    @MockitoBean TokenCipher tokenCipher;

    private MockMvc mvc;
    private User testUser;
    private Repository testRepo;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(wac)
            .apply(springSecurity())
            .build();

        testRunRepository.deleteAll();
        patchRepository.deleteAll();
        findingRepository.deleteAll();
        scanRepository.deleteAll();
        repositories.deleteAll();
        userRepository.deleteAll();

        testUser = new User(12345L, "testuser", "https://example.com/avatar.png", "enc-token");
        userRepository.save(testUser);

        testRepo = new Repository();
        testRepo.setId(UUID.randomUUID());
        testRepo.setUserId(testUser.getId());
        testRepo.setGithubRepoId(98765L);
        testRepo.setFullName("testuser/sample-repo");
        testRepo.setDefaultBranch("main");
        repositories.save(testRepo);

        when(currentUserService.require(any())).thenReturn(testUser);
        when(tokenCipher.decrypt("enc-token")).thenReturn("ghp_test_token");
    }

    // ──────────────────────────────────────────────────────────────────────
    // 1. POST /scans → 런너 위임 검증
    // ──────────────────────────────────────────────────────────────────────

    @Test
    void 스캔_생성_후_런너에_위임한다() throws Exception {
        String body = objectMapper.writeValueAsString(
            Map.of("repositoryId", testRepo.getId(), "ref", "main"));

        MvcResult result = mvc.perform(post("/api/v1/scans")
                .with(oauth2Login())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isAccepted())
            .andExpect(jsonPath("$.status").value("QUEUED"))
            .andReturn();

        UUID scanId = UUID.fromString(
            objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());

        verify(runnerClient).delegateScan(
            eq(scanId.toString()),
            eq("https://github.com/testuser/sample-repo.git"),
            eq("main"),
            any());
    }

    // ──────────────────────────────────────────────────────────────────────
    // 2~6. 콜백 파이프라인 전체 흐름 (주요 E2E 시나리오)
    // ──────────────────────────────────────────────────────────────────────

    @Test
    void 콜백_파이프라인_Finding_영속화_및_최종상태_COMPLETED() throws Exception {
        UUID scanId = createScan("main");

        // stage: SCANNING/RUNNING → scan status = SCANNING
        sendCallback(Map.of(
            "scanId", scanId.toString(), "kind", "stage",
            "stage", "SCANNING", "agent", 1, "status", "RUNNING"));
        assertThat(scanRepository.findById(scanId))
            .hasValueSatisfying(s -> assertThat(s.getStatus()).isEqualTo(ScanStatus.SCANNING));

        // finding 이벤트 → findings 테이블 INSERT
        Map<String, Object> findingPayload = Map.of(
            "cveId", "CVE-2023-32681",
            "packageName", "requests",
            "currentVersion", "2.28.0",
            "recommendedVersion", "2.31.0",
            "severity", "MEDIUM",
            "cvssScore", 6.1,
            "manifestPath", "requirements.txt",
            "filePath", "requirements.txt"
        );
        sendCallback(Map.of("scanId", scanId.toString(), "kind", "finding",
            "payload", findingPayload));

        List<Finding> findings = findingRepository
            .findByScanId(scanId, Pageable.unpaged()).getContent();
        assertThat(findings).hasSize(1);
        Finding saved = findings.get(0);
        assertThat(saved.getCveId()).isEqualTo("CVE-2023-32681");
        assertThat(saved.getPackageName()).isEqualTo("requests");
        assertThat(saved.getCurrentVersion()).isEqualTo("2.28.0");
        assertThat(saved.getRecommendedVersion()).isEqualTo("2.31.0");
        assertThat(saved.getSeverity()).hasToString("MEDIUM");
        assertThat(saved.getCvssScore()).isNotNull();

        // 중복 finding → 멱등성: 예외 없이 무시, 건수 유지
        sendCallback(Map.of("scanId", scanId.toString(), "kind", "finding",
            "payload", findingPayload));
        assertThat(findingRepository.findByScanId(scanId, Pageable.unpaged())).hasSize(1);

        // stage: SCANNING/DONE
        sendCallback(Map.of(
            "scanId", scanId.toString(), "kind", "stage",
            "stage", "SCANNING", "agent", 1, "status", "DONE"));

        // done: COMPLETED → finishedAt 기록
        sendCallback(Map.of("scanId", scanId.toString(), "kind", "done",
            "status", "COMPLETED"));
        assertThat(scanRepository.findById(scanId)).hasValueSatisfying(s -> {
            assertThat(s.getStatus()).isEqualTo(ScanStatus.COMPLETED);
            assertThat(s.getFinishedAt()).isNotNull();
        });

        // GET /scans/{id}/findings → finding 1건 반환
        mvc.perform(get("/api/v1/scans/{id}/findings", scanId)
                .with(oauth2Login()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].cveId").value("CVE-2023-32681"))
            .andExpect(jsonPath("$.content[0].packageName").value("requests"));
    }

    @Test
    void done_NO_FINDINGS_상태는_finding_없이_종료된다() throws Exception {
        UUID scanId = createScan("main");

        sendCallback(Map.of("scanId", scanId.toString(), "kind", "done",
            "status", "NO_FINDINGS"));

        assertThat(scanRepository.findById(scanId))
            .hasValueSatisfying(s -> assertThat(s.getStatus()).isEqualTo(ScanStatus.NO_FINDINGS));
        assertThat(findingRepository.findByScanId(scanId, Pageable.unpaged())).isEmpty();
    }

    @Test
    void HMAC_서명_불일치_콜백은_401_반환() throws Exception {
        UUID scanId = createScan("main");
        byte[] body = objectMapper.writeValueAsBytes(Map.of(
            "scanId", scanId.toString(), "kind", "stage",
            "stage", "SCANNING", "agent", 1, "status", "RUNNING"));

        mvc.perform(post("/api/v1/internal/runner/events")
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-VibeGuard-Signature", "sha256=invalidsignature")
                .header("X-VibeGuard-Timestamp", String.valueOf(System.currentTimeMillis()))
                .content(body))
            .andExpect(status().isUnauthorized());

        // 상태 변경 없어야 함
        assertThat(scanRepository.findById(scanId))
            .hasValueSatisfying(s -> assertThat(s.getStatus()).isEqualTo(ScanStatus.QUEUED));
    }

    @Test
    void AGENT_NOT_CONFIGURED_종료_상태_처리() throws Exception {
        UUID scanId = createScan("main");

        sendCallback(Map.of("scanId", scanId.toString(), "kind", "done",
            "status", "AGENT_NOT_CONFIGURED"));

        assertThat(scanRepository.findById(scanId))
            .hasValueSatisfying(s ->
                assertThat(s.getStatus()).isEqualTo(ScanStatus.AGENT_NOT_CONFIGURED));
    }

    // ──────────────────────────────────────────────────────────────────────
    // 7. REGRESSION_CHECK DONE → Patch·TestRun 영속화 + test-runs API
    // ──────────────────────────────────────────────────────────────────────

    @Test
    void REGRESSION_CHECK_DONE_Patch와_TestRun_DB_저장_및_API_응답() throws Exception {
        UUID scanId = createScan("main");

        // finding 먼저 등록 — REGRESSION_CHECK이 참조할 packageName
        sendCallback(Map.of("scanId", scanId.toString(), "kind", "finding",
            "payload", Map.of(
                "cveId", "CVE-2023-32681",
                "packageName", "requests",
                "currentVersion", "2.28.0",
                "recommendedVersion", "2.31.0",
                "severity", "MEDIUM",
                "cvssScore", 6.1,
                "manifestPath", "requirements.txt",
                "filePath", "requirements.txt"
            )));

        // REGRESSION_CHECK RUNNING → scan status 전이
        sendCallback(Map.of(
            "scanId", scanId.toString(), "kind", "stage",
            "stage", "REGRESSION_CHECK", "agent", 3, "status", "RUNNING"));
        assertThat(scanRepository.findById(scanId))
            .hasValueSatisfying(s -> assertThat(s.getStatus()).isEqualTo(ScanStatus.REGRESSION_CHECK));

        // A3 출력 JSON 구성
        String stageOutput = objectMapper.writeValueAsString(Map.of(
            "outcome", "PASSED",
            "baseline", "PASSED",
            "postPatch", "PASSED",
            "patches", List.of(Map.of(
                "packageName", "requests",
                "from", "2.28.0",
                "to", "2.31.0",
                "versionStrategy", "withinMajor"
            )),
            "manifestPath", "requirements.txt"
        ));

        // REGRESSION_CHECK DONE (stageOutput 포함) → Patch·TestRun 저장
        sendCallback(Map.of(
            "scanId", scanId.toString(), "kind", "stage",
            "stage", "REGRESSION_CHECK", "agent", 3, "status", "DONE",
            "payload", Map.of("hasOutput", true, "stageOutput", stageOutput)));

        // Patch DB 확인
        List<Finding> findings = findingRepository
            .findByScanId(scanId, org.springframework.data.domain.Pageable.unpaged()).getContent();
        assertThat(findings).hasSize(1);
        var patches = patchRepository.findFirstByFindingIdOrderByAttemptNoDesc(findings.get(0).getId());
        assertThat(patches).isPresent();

        // TestRun DB 확인: PRE_PATCH + POST_PATCH 각 1건
        var testRuns = testRunRepository.findByScanIdAndUserId(scanId, testUser.getId());
        assertThat(testRuns).hasSize(2);
        assertThat(testRuns.stream().map(tr -> tr.getPhase()).toList())
            .containsExactlyInAnyOrder(TestPhase.PRE_PATCH, TestPhase.POST_PATCH);
        assertThat(testRuns).allSatisfy(tr -> assertThat(tr.isPassed()).isTrue());

        // done: COMPLETED
        sendCallback(Map.of("scanId", scanId.toString(), "kind", "done", "status", "COMPLETED"));

        // GET /api/v1/scans/{id}/test-runs → 2건 반환
        mvc.perform(get("/api/v1/scans/{id}/test-runs", scanId)
                .with(oauth2Login()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].passed").value(true))
            .andExpect(jsonPath("$[1].passed").value(true));
    }

    @Test
    void REGRESSION_CHECK_DONE_중복_콜백_멱등성_보장() throws Exception {
        UUID scanId = createScan("main");

        sendCallback(Map.of("scanId", scanId.toString(), "kind", "finding",
            "payload", Map.of(
                "cveId", "CVE-2023-11111",
                "packageName", "urllib3",
                "currentVersion", "1.26.0",
                "recommendedVersion", "2.0.0",
                "severity", "HIGH",
                "manifestPath", "requirements.txt",
                "filePath", "requirements.txt"
            )));

        String stageOutput = objectMapper.writeValueAsString(Map.of(
            "outcome", "PASSED",
            "baseline", "PASSED",
            "postPatch", "PASSED",
            "patches", List.of(Map.of("packageName", "urllib3", "from", "1.26.0", "to", "2.0.0"))
        ));

        Map<String, Object> doneEvent = Map.of(
            "scanId", scanId.toString(), "kind", "stage",
            "stage", "REGRESSION_CHECK", "agent", 3, "status", "DONE",
            "payload", Map.of("hasOutput", true, "stageOutput", stageOutput));

        // 동일 DONE 이벤트 2회 전송 → 멱등성
        sendCallback(doneEvent);
        sendCallback(doneEvent);

        // TestRun은 PRE_PATCH·POST_PATCH 각 1건씩만 존재해야 함
        var testRuns = testRunRepository.findByScanIdAndUserId(scanId, testUser.getId());
        assertThat(testRuns).hasSize(2);
    }

    // ──────────────────────────────────────────────────────────────────────
    // 헬퍼
    // ──────────────────────────────────────────────────────────────────────

    /** POST /scans로 스캔을 생성하고 scanId를 반환. */
    private UUID createScan(String ref) throws Exception {
        String body = objectMapper.writeValueAsString(
            Map.of("repositoryId", testRepo.getId(), "ref", ref));
        MvcResult result = mvc.perform(post("/api/v1/scans")
                .with(oauth2Login())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isAccepted())
            .andReturn();
        return UUID.fromString(
            objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
    }

    /** HMAC 서명 콜백 이벤트 전송. 204 No Content를 기대한다. */
    private void sendCallback(Map<String, Object> event) throws Exception {
        byte[] body = objectMapper.writeValueAsBytes(event);
        String signature = hmacSigner.sign(body);
        String timestamp = String.valueOf(System.currentTimeMillis());

        mvc.perform(post("/api/v1/internal/runner/events")
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-VibeGuard-Signature", signature)
                .header("X-VibeGuard-Timestamp", timestamp)
                .content(body))
            .andExpect(status().isNoContent());
    }
}
