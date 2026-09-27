package dev.vibeguard.api.patch;

/**
 * 회귀 테스트 단계 (PRD §6.4, 방향 전환 v2).
 * 재현 테스트를 만들지 않으므로, 리포의 기존 테스트를 패치 전후로 실행한다.
 * PRE_PATCH = 패치 전(기준선), POST_PATCH = 패치 후(하위 호환 확인).
 * (구 REGRESSION 단계는 제거됨 — 이제 두 단계 모두 리포의 기존 테스트 실행)
 */
public enum TestPhase {
    PRE_PATCH,
    POST_PATCH
}
