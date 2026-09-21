package dev.vibeguard.api.repository;

import dev.vibeguard.api.auth.CurrentUserService;
import dev.vibeguard.api.user.User;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 리포지토리 연결/조회 API (PRD §9, F-02). */
@RestController
@RequestMapping("/api/v1/repositories")
public class RepositoryController {

    private final RepositoryService repositoryService;
    private final CurrentUserService currentUserService;

    public RepositoryController(RepositoryService repositoryService, CurrentUserService currentUserService) {
        this.repositoryService = repositoryService;
        this.currentUserService = currentUserService;
    }

    /**
     * 리포 목록 조회.
     * - source=github: GitHub에서 접근 가능한 리포(연결 후보)
     * - 기본: 우리 DB에 이미 연결된 리포
     */
    @GetMapping
    public ResponseEntity<?> list(
        @AuthenticationPrincipal OAuth2User principal,
        @RequestParam(name = "source", required = false) String source) {
        User user = currentUserService.require(principal);
        if ("github".equalsIgnoreCase(source)) {
            List<GitHubRepoDto> repos = repositoryService.listGitHubRepositories(user);
            return ResponseEntity.ok(repos);
        }
        List<RepositoryDto> repos = repositoryService.listConnected(user);
        return ResponseEntity.ok(repos);
    }

    /** 리포 연결. */
    @PostMapping
    public ResponseEntity<RepositoryDto> connect(
        @AuthenticationPrincipal OAuth2User principal,
        @Valid @RequestBody ConnectRepositoryRequest req) {
        User user = currentUserService.require(principal);
        RepositoryDto dto = repositoryService.connect(user, req);
        return ResponseEntity.ok(dto);
    }
}
