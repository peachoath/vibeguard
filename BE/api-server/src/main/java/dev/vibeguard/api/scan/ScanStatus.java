package dev.vibeguard.api.scan;

/**
 * 스캔 파이프라인 상태 (PRD §6.1 상태머신, 방향 전환 v2).
 *
 * <pre>
 * QUEUED → CLONING → SCANNING(A1) → VERIFYING(A2) → REGRESSION_CHECK(A3) → PR_CREATING(A4) → COMPLETED
 *                          ↓             ↓                   ↓                     ↓
 *                       FAILED      NO_FINDINGS        PATCH_FAILED          REGRESSION_BLOCKED
 *
 * 미구성 종료 상태:
 *   AGENT_NOT_CONFIGURED — ANTHROPIC_API_KEY 미설정으로 에이전트 세션을 시작하지 못함.
 *   MCP_NOT_AVAILABLE    — API 키는 있지만 MCP 서버가 응답하지 않거나 미등록.
 *   INSTALL_FAILED       — 의존성 설치 실패로 회귀 테스트를 실행하지 못함.
 *   NO_TESTS             — 리포에 테스트가 없어 회귀 증명 없이 완료(vacuous truth).
 * </pre>
 */
public enum ScanStatus {
    QUEUED,
    CLONING,
    SCANNING,
    VERIFYING,
    REGRESSION_CHECK,
    PR_CREATING,
    COMPLETED,
    NO_FINDINGS,
    PATCH_FAILED,
    REGRESSION_BLOCKED,
    FAILED,
    /** ANTHROPIC_API_KEY 미설정으로 에이전트를 실행하지 못함. */
    AGENT_NOT_CONFIGURED,
    /** API 키는 있지만 필요한 MCP 서버가 미응답/미등록. */
    MCP_NOT_AVAILABLE,
    /** 의존성 설치 실패로 테스트 실행 불가. */
    INSTALL_FAILED,
    /** 리포에 테스트가 없어 회귀 증명 생략. */
    NO_TESTS;

    /** 더 이상 진행하지 않는 종료 상태인지 여부. */
    public boolean isTerminal() {
        return this == COMPLETED
            || this == NO_FINDINGS
            || this == PATCH_FAILED
            || this == REGRESSION_BLOCKED
            || this == FAILED
            || this == AGENT_NOT_CONFIGURED
            || this == MCP_NOT_AVAILABLE
            || this == INSTALL_FAILED
            || this == NO_TESTS;
    }

    /** 진행 중(비종료) 상태 목록 — 중복 스캔 방지 조회에 사용. */
    public static java.util.List<ScanStatus> activeStatuses() {
        return java.util.Arrays.stream(values())
            .filter(s -> !s.isTerminal())
            .toList();
    }
}
