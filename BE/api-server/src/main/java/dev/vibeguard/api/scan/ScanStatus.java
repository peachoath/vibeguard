package dev.vibeguard.api.scan;

/**
 * 스캔 파이프라인 상태 (PRD §6.1 상태머신).
 *
 * <pre>
 * QUEUED → CLONING → SCANNING(A1) → VERIFYING(A2) → PATCHING(A3) → PR_CREATING(A4) → COMPLETED
 *                          ↓             ↓              ↓                ↓
 *                       FAILED      NO_FINDINGS   PATCH_FAILED    REGRESSION_BLOCKED
 * </pre>
 */
public enum ScanStatus {
    QUEUED,
    CLONING,
    SCANNING,
    VERIFYING,
    PATCHING,
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
