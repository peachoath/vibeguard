package dev.vibeguard.api.scan;

/**
 * 스캔 파이프라인 상태 (PRD §6.1 상태머신, 방향 전환 v2).
 *
 * <pre>
 * QUEUED → CLONING → SCANNING(A1) → VERIFYING(A2) → REGRESSION_CHECK(A3) → PR_CREATING(A4) → COMPLETED
 *                          ↓             ↓                   ↓                     ↓
 *                       FAILED      NO_FINDINGS        PATCH_FAILED          REGRESSION_BLOCKED
 * </pre>
 *
 * REGRESSION_CHECK(A3): 설치→테스트(패치 전) → 버전 상향 → 설치→테스트(패치 후).
 * 테스트가 없는 리포는 회귀 증명 없이 통과 처리 후 PR_CREATING으로 진행.
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
    FAILED;

    /** 더 이상 진행하지 않는 종료 상태인지 여부. */
    public boolean isTerminal() {
        return this == COMPLETED
            || this == NO_FINDINGS
            || this == PATCH_FAILED
            || this == REGRESSION_BLOCKED
            || this == FAILED;
    }

    /** 진행 중(비종료) 상태 목록 — 중복 스캔 방지 조회에 사용. */
    public static java.util.List<ScanStatus> activeStatuses() {
        return java.util.Arrays.stream(values())
            .filter(s -> !s.isTerminal())
            .toList();
    }
}
