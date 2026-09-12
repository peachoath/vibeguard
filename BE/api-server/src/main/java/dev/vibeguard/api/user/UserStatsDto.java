package dev.vibeguard.api.user;

/** 계정 요약 통계 (이슈 #7, GET /users/me/stats). 마이페이지 "계정" 탭 표시용. */
public record UserStatsDto(
    long repositoryCount,
    long scanCount
) {
}
