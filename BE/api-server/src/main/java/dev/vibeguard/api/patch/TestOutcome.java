package dev.vibeguard.api.patch;

/**
 * 테스트 실행 결과 원인 구분 (PRD §10, 방향 전환 v2).
 * passed(bool)만으로는 "테스트 없음/설치 실패/메모리 초과"를 "실패"와 구분할 수 없어
 * 정직성 원칙이 DB 단계에서 새므로 outcome으로 원인을 명시한다.
 */
public enum TestOutcome {
    PASSED,
    FAILED,
    NO_TESTS,
    OOM_KILLED,
    TIMED_OUT,
    INSTALL_FAILED
}
