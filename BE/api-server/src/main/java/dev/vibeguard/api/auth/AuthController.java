package dev.vibeguard.api.auth;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 현재 로그인 사용자 조회. 로그아웃은 SecurityConfig의 POST /api/v1/auth/logout 이 처리. */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(@AuthenticationPrincipal OAuth2User principal) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of(
            "githubId", ((Number) principal.getAttribute("id")).longValue(),
            "login", principal.getAttribute("login"),
            "avatarUrl", principal.getAttribute("avatar_url")));
    }
}
