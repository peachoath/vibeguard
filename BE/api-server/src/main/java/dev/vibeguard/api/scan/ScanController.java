package dev.vibeguard.api.scan;

import dev.vibeguard.api.auth.CurrentUserService;
import dev.vibeguard.api.user.User;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
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

/** 스캔 트리거/상태/취소 API (PRD §9, F-03/F-13). */
@RestController
@RequestMapping("/api/v1/scans")
public class ScanController {

    private final ScanService scanService;
    private final CurrentUserService currentUserService;

    public ScanController(ScanService scanService, CurrentUserService currentUserService) {
        this.scanService = scanService;
        this.currentUserService = currentUserService;
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
