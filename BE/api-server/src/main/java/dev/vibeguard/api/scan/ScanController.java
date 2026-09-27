package dev.vibeguard.api.scan;

import dev.vibeguard.api.auth.CurrentUserService;
import dev.vibeguard.api.patch.TestRunDto;
import dev.vibeguard.api.patch.TestRunRepository;
import dev.vibeguard.api.patch.PatchRepository;
import dev.vibeguard.api.patch.Patch;
import dev.vibeguard.api.sse.SseHub;
import dev.vibeguard.api.user.User;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** 스캔 트리거/상태/취소/진행 스트림 API (PRD §9, F-03/F-04/F-13). */
@RestController
@RequestMapping("/api/v1/scans")
public class ScanController {

    private final ScanService scanService;
    private final CurrentUserService currentUserService;
    private final SseHub sseHub;
    private final TestRunRepository testRunRepository;
    private final PatchRepository patchRepository;

    public ScanController(ScanService scanService, CurrentUserService currentUserService,
                          SseHub sseHub, TestRunRepository testRunRepository,
                          PatchRepository patchRepository) {
        this.scanService = scanService;
        this.currentUserService = currentUserService;
        this.sseHub = sseHub;
        this.testRunRepository = testRunRepository;
        this.patchRepository = patchRepository;
    }

    /** 내 스캔 목록 (최신순 50건). */
    @GetMapping
    public ResponseEntity<java.util.List<ScanDto>> list(
        @AuthenticationPrincipal OAuth2User principal) {
        User user = currentUserService.require(principal);
        java.util.List<ScanDto> dtos = scanService.listByUser(user).stream()
            .map(ScanDto::from)
            .toList();
        return ResponseEntity.ok(dtos);
    }

    /** 스캔 시작 — 비동기 위임. 202 Accepted. */
    @PostMapping
    public ResponseEntity<ScanDto> create(
        @AuthenticationPrincipal OAuth2User principal,
        @Valid @RequestBody CreateScanRequest req) {
        User user = currentUserService.require(principal);
        Scan scan = scanService.startScan(user, req);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ScanDto.from(scan));
    }

    /** 스캔 상태 조회. 소유권 검증 포함. */
    @GetMapping("/{id}")
    public ResponseEntity<ScanDto> get(
        @AuthenticationPrincipal OAuth2User principal,
        @PathVariable UUID id) {
        User user = currentUserService.require(principal);
        return ResponseEntity.ok(ScanDto.from(scanService.getForUser(id, user.getId())));
    }

    /**
     * 스캔 진행 SSE 스트림 (F-04). stage/log/finding/done 이벤트를 실시간 전송.
     * 소유권 검증 포함. 이미 종료된 스캔은 즉시 done 이벤트를 보내고 닫는다.
     */
    @GetMapping(value = "/{id}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(
        @AuthenticationPrincipal OAuth2User principal,
        @PathVariable UUID id) {
        User user = currentUserService.require(principal);
        Scan scan = scanService.getForUser(id, user.getId());
        SseEmitter emitter = sseHub.subscribe(id);
        if (scan.getStatus().isTerminal()) {
            sseHub.broadcast(id, "done", ScanDto.from(scan));
            sseHub.complete(id);
        }
        return emitter;
    }

    /** 스캔 취소. 204 No Content. 소유권 검증 포함. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> cancel(
        @AuthenticationPrincipal OAuth2User principal,
        @PathVariable UUID id) {
        User user = currentUserService.require(principal);
        scanService.cancelForUser(id, user.getId());
        return ResponseEntity.noContent().build();
    }

    /**
     * 스캔의 회귀 테스트 결과 목록 (PRE_PATCH·POST_PATCH, 생성 순).
     * findings → patches → test_runs 경로로 조회하며 소유권 검증 포함.
     */
    @GetMapping("/{id}/test-runs")
    public ResponseEntity<List<TestRunDto>> testRuns(
        @AuthenticationPrincipal OAuth2User principal,
        @PathVariable UUID id) {
        User user = currentUserService.require(principal);
        // 소유권 확인: scanId로 scan 조회 — 없거나 소유권 없으면 NotFoundException
        scanService.getForUser(id, user.getId());

        List<TestRunDto> dtos = testRunRepository.findByScanIdAndUserId(id, user.getId())
            .stream()
            .map(tr -> {
                Patch patch = patchRepository.findById(tr.getPatchId()).orElse(null);
                UUID findingId = patch != null ? patch.getFindingId() : null;
                return TestRunDto.from(tr, findingId);
            })
            .toList();
        return ResponseEntity.ok(dtos);
    }
}
