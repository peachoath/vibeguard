package dev.vibeguard.api.finding;

import dev.vibeguard.api.auth.CurrentUserService;
import dev.vibeguard.api.user.User;
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

/** Finding 목록/상세/무시/증거/Diff API (PRD §9, F-05~F-08/F-12). 모든 엔드포인트에 소유권 검증. */
@RestController
public class FindingController {

    private final FindingService findingService;
    private final CurrentUserService currentUserService;

    public FindingController(FindingService findingService, CurrentUserService currentUserService) {
        this.findingService = findingService;
        this.currentUserService = currentUserService;
    }

    /** 스캔별 Finding 목록 (필터·페이징). 스캔 소유권 검증 포함. */
    @GetMapping("/api/v1/scans/{scanId}/findings")
    public ResponseEntity<Page<FindingDto>> list(
        @AuthenticationPrincipal OAuth2User principal,
        @PathVariable UUID scanId,
        @RequestParam(required = false) Severity severity,
        @RequestParam(required = false) FindingType type,
        @RequestParam(required = false) FindingStatus status,
        Pageable pageable) {
        User user = currentUserService.require(principal);
        return ResponseEntity.ok(findingService.list(scanId, user.getId(), severity, type, status, pageable));
    }

    /** Finding 상세 + 근거. 소유권 검증 포함. */
    @GetMapping("/api/v1/findings/{id}")
    public ResponseEntity<FindingDetailDto> detail(
        @AuthenticationPrincipal OAuth2User principal,
        @PathVariable UUID id) {
        User user = currentUserService.require(principal);
        return ResponseEntity.ok(findingService.detail(id, user.getId()));
    }

    /** 오탐 처리(무시). 소유권 검증 포함. */
    @PatchMapping("/api/v1/findings/{id}/ignore")
    public ResponseEntity<FindingDto> ignore(
        @AuthenticationPrincipal OAuth2User principal,
        @PathVariable UUID id,
        @Valid @RequestBody IgnoreRequest req) {
        User user = currentUserService.require(principal);
        return ResponseEntity.ok(findingService.ignore(id, user.getId(), req.reason()));
    }

    /** TDD 증거 (phase별 결과). 소유권 검증 포함. */
    @GetMapping("/api/v1/findings/{id}/evidence")
    public ResponseEntity<EvidenceDto> evidence(
        @AuthenticationPrincipal OAuth2User principal,
        @PathVariable UUID id) {
        User user = currentUserService.require(principal);
        return ResponseEntity.ok(findingService.evidence(id, user.getId()));
    }

    /** 패치 diff. 소유권 검증 포함. */
    @GetMapping("/api/v1/findings/{id}/diff")
    public ResponseEntity<DiffDto> diff(
        @AuthenticationPrincipal OAuth2User principal,
        @PathVariable UUID id) {
        User user = currentUserService.require(principal);
        return ResponseEntity.ok(findingService.diff(id, user.getId()));
    }
}
