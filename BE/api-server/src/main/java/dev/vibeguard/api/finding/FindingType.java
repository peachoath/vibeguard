package dev.vibeguard.api.finding;

/**
 * Finding 유형 (PRD §10, 방향 전환 v2).
 * SCA = 의존성(라이브러리) 취약점. 이번 MVP는 SCA만 지원한다.
 * SAST(소스 코드 정적 분석)는 추후 확장이며, DB CHECK 제약도 SCA만 허용한다(V2).
 */
public enum FindingType {
    SCA
}
