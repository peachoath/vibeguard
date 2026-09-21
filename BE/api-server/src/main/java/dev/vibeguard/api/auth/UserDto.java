package dev.vibeguard.api.auth;

/**
 * 현재 로그인 사용자 응답 (PRD §9 GET /auth/me).
 * access_token 등 민감 정보는 절대 포함하지 않는다 (NFR-S3).
 */
public record UserDto(
    Long githubId,
    String login,
    String avatarUrl
) {
}
