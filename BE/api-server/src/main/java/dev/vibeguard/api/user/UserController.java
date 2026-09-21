package dev.vibeguard.api.user;

import dev.vibeguard.api.auth.CurrentUserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 마이페이지 / 계정 관리 API (이슈 #7, F-01 확장).
 * 모든 엔드포인트는 인증 세션의 현재 사용자에만 작용한다(경로에 사용자 식별자 없음).
 */
@RestController
@RequestMapping("/api/v1/users/me")
public class UserController {

    private final UserService userService;
    private final CurrentUserService currentUserService;

    public UserController(UserService userService, CurrentUserService currentUserService) {
        this.userService = userService;
        this.currentUserService = currentUserService;
    }

    /** 프로필 조회. */
    @GetMapping
    public ResponseEntity<UserProfileDto> getProfile(@AuthenticationPrincipal OAuth2User principal) {
        return ResponseEntity.ok(userService.getProfile(currentUserService.require(principal)));
    }

    /** 계정 요약 통계 (연결 리포 수·스캔 수). */
    @GetMapping("/stats")
    public ResponseEntity<UserStatsDto> getStats(@AuthenticationPrincipal OAuth2User principal) {
        return ResponseEntity.ok(userService.getStats(currentUserService.require(principal)));
    }

    /** 프로필 수정 (표시 이름·이메일). */
    @PatchMapping
    public ResponseEntity<UserProfileDto> updateProfile(
            @AuthenticationPrincipal OAuth2User principal,
            @Valid @RequestBody UpdateProfileRequest req) {
        return ResponseEntity.ok(userService.updateProfile(currentUserService.require(principal), req));
    }

    /** GitHub 프로필(login·avatar) 재동기화. */
    @PostMapping("/resync")
    public ResponseEntity<UserProfileDto> resync(@AuthenticationPrincipal OAuth2User principal) {
        return ResponseEntity.ok(userService.resyncFromGitHub(currentUserService.require(principal)));
    }

    /** 알림/정책 설정 조회. */
    @GetMapping("/settings")
    public ResponseEntity<UserSettingsDto> getSettings(@AuthenticationPrincipal OAuth2User principal) {
        return ResponseEntity.ok(userService.getSettings(currentUserService.require(principal)));
    }

    /** 알림/정책 설정 수정. */
    @PatchMapping("/settings")
    public ResponseEntity<UserSettingsDto> updateSettings(
            @AuthenticationPrincipal OAuth2User principal,
            @Valid @RequestBody UpdateSettingsRequest req) {
        return ResponseEntity.ok(userService.updateSettings(currentUserService.require(principal), req));
    }

    /**
     * 회원 탈퇴. 계정·연관 데이터를 삭제하고 세션을 무효화한다(로그아웃과 동일한 정리).
     */
    @DeleteMapping
    public ResponseEntity<Void> deleteAccount(
            @AuthenticationPrincipal OAuth2User principal,
            HttpServletRequest request,
            HttpServletResponse response) {
        userService.deleteAccount(currentUserService.require(principal));
        invalidateSession(request, response);
        return ResponseEntity.noContent().build();
    }

    /** 세션 무효화 + JSESSIONID 쿠키 삭제 + SecurityContext 정리 (SecurityConfig logout 과 정합). */
    private void invalidateSession(HttpServletRequest request, HttpServletResponse response) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        jakarta.servlet.http.Cookie cookie = new jakarta.servlet.http.Cookie("JSESSIONID", null);
        cookie.setMaxAge(0);
        cookie.setPath("/");
        response.addCookie(cookie);
    }
}
