package dev.vibeguard.api.user;

import dev.vibeguard.api.finding.Severity;
import java.util.List;

/** 사용자 알림/정책 설정 응답 (이슈 #7, GET/PATCH /users/me/settings). */
public record UserSettingsDto(
    Severity minSeverity,
    List<String> excludedPaths,
    boolean notifyEmail
) {
    public static UserSettingsDto from(UserSettings s) {
        return new UserSettingsDto(s.getMinSeverity(), s.getExcludedPaths(), s.isNotifyEmail());
    }
}
