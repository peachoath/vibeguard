package dev.vibeguard.api.scan;

import dev.vibeguard.api.auth.CurrentUserService;
import dev.vibeguard.api.sse.SseHub;
import dev.vibeguard.api.user.User;
import jakarta.validation.Valid;
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

    public ScanController(ScanService scanService, CurrentUserService currentUserService, SseHub sseHub) {
        this.scanService = scanService;
        this.currentUserService = currentUserService;
        this.sseHub = sseHub;
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

    /** 스캔 상태 조회. */
    @GetMapping("/{id}")
    public ResponseEntity<ScanDto> get(
        @AuthenticationPrincipal OAuth2User principal,
        @PathVariable UUID id) {
        currentUserService.require(principal);
        return ResponseEntity.ok(ScanDto.from(scanService.get(id)));
    }

    /**
     * 스캔 진행 SSE 스트림 (F-04). stage/log/finding/done 이벤트를 실시간 전송.
     * 존재하지 않는 스캔이면 get()에서 404. 이미 종료된 스캔은 즉시 완료 처리된다.
     */
    @GetMapping(value = "/{id}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(
        @AuthenticationPrincipal OAuth2User principal,
        @PathVariable UUID id) {
        currentUserService.require(principal);
        Scan scan = scanService.get(id); // 없으면 404
        SseEmitter emitter = sseHub.subscribe(id);
        // 이미 종료된 스캔이면 done 이벤트 한 번 보내고 닫는다(뒤늦게 구독한 클라이언트 대비).
        if (scan.getStatus().isTerminal()) {
            sseHub.broadcast(id, "done", ScanDto.from(scan));
            sseHub.complete(id);
        }
        return emitter;
    }

    /** 스캔 취소. 204 No Content. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> cancel(
        @AuthenticationPrincipal OAuth2User principal,
        @PathVariable UUID id) {
        currentUserService.require(principal);
        scanService.cancel(id);
        return ResponseEntity.noContent().build();
    }
}
