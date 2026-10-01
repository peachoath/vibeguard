package dev.vibeguard.api.dashboard;

/** 에이전트 단계별 평균 처리 시간(ms). 데이터가 없으면 null. */
public record StageDurationDto(
    Long scanMs,
    Long verificationMs,
    Long regressionMs,
    Long pullRequestMs
) {
}
