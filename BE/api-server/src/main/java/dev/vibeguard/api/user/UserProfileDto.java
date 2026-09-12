package dev.vibeguard.api.user;

import java.time.OffsetDateTime;

/**
 * 마이페이지 프로필 응답 (이슈 #7, GET/PATCH /users/me).
 * access_token 등 민감 정보는 절대 포함하지 않는다 (NFR-S3).
 * displayName 미설정 시 login 으로 대체한다.
 */
public record UserProfileDto(
    Long githubId,
    String login,
    String displayName,
    String email,
    String avatarUrl,
    OffsetDateTime createdAt
) {
    public static UserProfileDto from(User user) {
        String displayName = user.getDisplayName() != null ? user.getDisplayName() : user.getLogin();
        return new UserProfileDto(
            user.getGithubId(),
            user.getLogin(),
            displayName,
            user.getEmail(),
            user.getAvatarUrl(),
            user.getCreatedAt());
    }
}
