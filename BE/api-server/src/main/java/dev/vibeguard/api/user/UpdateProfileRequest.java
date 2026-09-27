package dev.vibeguard.api.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

/**
 * 프로필 수정 요청 (이슈 #7, PATCH /users/me).
 * 두 필드 모두 선택적(부분 수정). null 이면 해당 필드는 변경하지 않는다.
 * 빈 문자열("")은 값 해제(null 저장)로 처리한다.
 */
public record UpdateProfileRequest(
    @Size(max = 255, message = "표시 이름은 255자를 넘을 수 없습니다.") String displayName,
    @Email(message = "이메일 형식이 올바르지 않습니다.") @Size(max = 320) String email
) {
}
