package dev.vibeguard.api.user;

import dev.vibeguard.api.finding.Severity;
import java.util.List;

/**
 * 설정 수정 요청 (이슈 #7, PATCH /users/me/settings).
 * 각 필드는 선택적(부분 수정). null 이면 해당 항목은 변경하지 않는다.
 */
public record UpdateSettingsRequest(
    Severity minSeverity,
    List<String> excludedPaths,
    Boolean notifyEmail
) {
}
