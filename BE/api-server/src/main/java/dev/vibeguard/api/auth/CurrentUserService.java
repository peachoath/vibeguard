package dev.vibeguard.api.auth;

import dev.vibeguard.api.common.NotFoundException;
import dev.vibeguard.api.user.User;
import dev.vibeguard.api.user.UserRepository;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

/**
 * OAuth2 principal(GitHub 속성)로부터 우리 DB의 User를 조회하는 헬퍼.
 * 로그인 성공 시 CustomOAuth2UserService가 users를 upsert하므로 항상 존재해야 한다.
 */
@Service
public class CurrentUserService {

    private final UserRepository userRepository;

    public CurrentUserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /** principal의 GitHub id로 우리 User 조회. 없으면 401 성격의 예외로 처리. */
    public User require(OAuth2User principal) {
        if (principal == null || principal.getAttribute("id") == null) {
            throw new NotFoundException("인증된 사용자를 찾을 수 없습니다.");
        }
        Long githubId = ((Number) principal.getAttribute("id")).longValue();
        return userRepository.findByGithubId(githubId)
            .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다: githubId=" + githubId));
    }
}
