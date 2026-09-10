package dev.vibeguard.api.patch;

/**
 * TDD 증명 단계 (PRD §6.4).
 * PRE_PATCH = 패치 전(반드시 FAIL), POST_PATCH = 패치 후(PASS), REGRESSION = 회귀(100% 통과).
 */
public enum TestPhase {
    PRE_PATCH,
    POST_PATCH,
    REGRESSION
}
