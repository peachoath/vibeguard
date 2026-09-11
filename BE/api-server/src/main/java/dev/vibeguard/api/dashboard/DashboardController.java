package dev.vibeguard.api.dashboard;

import dev.vibeguard.api.auth.CurrentUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 대시보드 통계 API (PRD §9, F-11). */
@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;
    private final CurrentUserService currentUserService;

    public DashboardController(DashboardService dashboardService, CurrentUserService currentUserService) {
        this.dashboardService = dashboardService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/summary")
    public ResponseEntity<SummaryDto> summary(@AuthenticationPrincipal OAuth2User principal) {
        currentUserService.require(principal);
        return ResponseEntity.ok(dashboardService.summary());
    }
}
