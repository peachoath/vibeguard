package dev.vibeguard.api.finding;

import dev.vibeguard.api.auth.CurrentUserService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Finding 목록/상세/무시/증거/Diff API (PRD §9, F-05~F-08/F-12). */
@RestController
public class FindingController {

    private final FindingService findingService;
    private final CurrentUserService currentUserService;

    public FindingController(FindingService findingService, CurrentUserService currentUserService) {
        this.findingService = findingService;
        this.currentUserService = currentUserService;
    }

    /** 스캔별 Finding 목록 (필터·페이징). severity/type/status는 선택. */
    @GetMapping("/api/v1/scans/{scanId}/findings")
    public ResponseEntity<Page<FindingDto>> list(
        @AuthenticationPrincipal OAuth2User principal,
        @PathVariable UUID scanId,
        @RequestParam(required = false) Severity severity,
        @RequestParam(required = false) FindingType type,
        @RequestParam(required = false) FindingStatus status,
        Pageable pageable) {
        currentUserService.require(principal);
        return ResponseEntity.ok(findingService.list(scanId, severity, type, status, pageable));
    }

    /** Finding 상세 + 근거. */
    @GetMapping("/api/v1/findings/{id}")
    public ResponseEntity<FindingDetailDto> detail(
        @AuthenticationPrincipal OAuth2User principal,
        @PathVariable UUID id) {
        currentUserService.require(principal);
        return ResponseEntity.ok(findingService.detail(id));
    }

    /** 오탐 처리(무시). */
    @PatchMapping("/api/v1/findings/{id}/ignore")
    public ResponseEntity<FindingDto> ignore(
        @AuthenticationPrincipal OAuth2User principal,
        @PathVariable UUID id,
        @Valid @RequestBody IgnoreRequest req) {
        currentUserService.require(principal);
        return ResponseEntity.ok(findingService.ignore(id, req.reason()));
    }

    /** TDD 증거 (테스트 코드 + phase별 결과). */
    @GetMapping("/api/v1/findings/{id}/evidence")
    public ResponseEntity<EvidenceDto> evidence(
        @AuthenticationPrincipal OAuth2User principal,
        @PathVariable UUID id) {
        currentUserService.require(principal);
        return ResponseEntity.ok(findingService.evidence(id));
    }

    /** 패치 diff. */
    @GetMapping("/api/v1/findings/{id}/diff")
    public ResponseEntity<DiffDto> diff(
        @AuthenticationPrincipal OAuth2User principal,
        @PathVariable UUID id) {
        currentUserService.require(principal);
        return ResponseEntity.ok(findingService.diff(id));
    }
}
