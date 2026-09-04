package dev.vibeguard.api.security;

import dev.vibeguard.api.user.User;
import dev.vibeguard.api.user.UserRepository;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * GitHub 로그인 성공 시 사용자 정보를 조회해 users 테이블에 upsert 한다.
 * access token은 암호화하여 저장한다(NFR-S3).
 */
@Service
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;
    private final TokenCipher tokenCipher;

    public CustomOAuth2UserService(UserRepository userRepository, TokenCipher tokenCipher) {
        this.userRepository = userRepository;
        this.tokenCipher = tokenCipher;
    }

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oauthUser = super.loadUser(userRequest);

        Long githubId = ((Number) oauthUser.getAttribute("id")).longValue();
        String login = oauthUser.getAttribute("login");
        String avatarUrl = oauthUser.getAttribute("avatar_url");
        String encryptedToken = tokenCipher.encrypt(userRequest.getAccessToken().getTokenValue());

        userRepository.findByGithubId(githubId)
                .map(existing -> {
                    existing.setLogin(login);
                    existing.setAvatarUrl(avatarUrl);
                    existing.setAccessToken(encryptedToken);
                    return existing;
                })
                .orElseGet(() -> userRepository.save(new User(githubId, login, avatarUrl, encryptedToken)));

        return oauthUser;
    }
}
