package dev.vibeguard.api.scan;

import dev.vibeguard.api.finding.Finding;
import dev.vibeguard.api.finding.FindingRepository;
import dev.vibeguard.api.runner.RunnerClient;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * DRY_RUN 통합 테스트 전용 엔드포인트 — default/dev/test 프로파일에서만 활성화.
 *
 * <p>OAuth 없이 seed 데이터(users→repositories→scans)를 커밋한 뒤 Runner에 위임한다.
 * 커밋 전에 위임하면 콜백이 돌아왔을 때 DB에서 scan을 못 찾아 404가 난다.
 * ScanService.startScan()이 ScanCreator를 분리한 이유와 동일하다.
 */
@RestController
@RequestMapping("/api/v1/internal/dev")
@Profile({"default", "dev", "test"})
class DevScanController {

    private static final String DEV_USER_ID = "00000000-0000-0000-0000-000000000001";
    private static final String DEV_REPO_ID = "00000000-0000-0000-0000-000000000002";

    private final ScanRepository scanRepository;
    private final FindingRepository findingRepository;
    private final RunnerClient runnerClient;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;

    DevScanController(ScanRepository scanRepository, FindingRepository findingRepository,
                      RunnerClient runnerClient, JdbcTemplate jdbc, TransactionTemplate tx) {
        this.scanRepository = scanRepository;
        this.findingRepository = findingRepository;
        this.runnerClient = runnerClient;
        this.jdbc = jdbc;
        this.tx = tx;
    }

    @GetMapping("/scans/{id}")
    public ResponseEntity<Map<String, Object>> status(@PathVariable String id) {
        return scanRepository.findById(UUID.fromString(id))
            .map(s -> {
                var findings = findingRepository.findByScanId(s.getId(), Pageable.unpaged()).stream()
                    .map(f -> Map.of(
                        "cveId", f.getCveId() != null ? f.getCveId() : "",
                        "packageName", f.getPackageName() != null ? f.getPackageName() : "",
                        "currentVersion", f.getCurrentVersion() != null ? f.getCurrentVersion() : "",
                        "severity", f.getSeverity() != null ? f.getSeverity().name() : ""))
                    .toList();
                return ResponseEntity.ok(Map.<String, Object>of(
                    "scanId", s.getId().toString(),
                    "status", s.getStatus().name(),
                    "findingCount", findings.size(),
                    "findings", findings));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/scans")
    public ResponseEntity<Map<String, String>> create(@RequestBody Map<String, String> body) {
        String repoUrl = body.getOrDefault("repoUrl", "https://github.com/shinu61/vibeguard-seed-python");
        String ref     = body.getOrDefault("ref", "");

        // ① seed + scan 저장 → 즉시 커밋 (이후 콜백이 돌아와도 findById 성공)
        Scan scan = tx.execute(status -> {
            jdbc.update("""
                INSERT INTO users (id, github_id, login, avatar_url, access_token)
                VALUES (?::uuid, 0, 'dev-seed', null, 'dev-token')
                ON CONFLICT (id) DO NOTHING
                """, DEV_USER_ID);
            jdbc.update("""
                INSERT INTO repositories (id, user_id, github_repo_id, full_name, default_branch, language)
                VALUES (?::uuid, ?::uuid, 0, 'shinu61/vibeguard-seed-python', 'main', 'Python')
                ON CONFLICT (id) DO NOTHING
                """, DEV_REPO_ID, DEV_USER_ID);
            return scanRepository.save(new Scan(UUID.fromString(DEV_REPO_ID), ref));
        });

        // ② 커밋 완료 후 러너 위임
        String scanId = scan.getId().toString();
        try {
            runnerClient.delegateScan(scanId, repoUrl, ref, null);
        } catch (Exception ex) {
            tx.execute(s -> {
                scan.setStatus(ScanStatus.FAILED);
                scan.setErrorCode("RUNNER_DELEGATE_FAILED");
                return scanRepository.save(scan);
            });
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("scanId", scanId, "error", ex.getMessage()));
        }

        return ResponseEntity.status(HttpStatus.ACCEPTED)
            .body(Map.of("scanId", scanId, "status", "QUEUED", "repoUrl", repoUrl));
    }
}
