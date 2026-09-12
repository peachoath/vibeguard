package dev.vibeguard.api.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.vibeguard.api.finding.Severity;
import dev.vibeguard.api.repository.GitHubClient;
import dev.vibeguard.api.security.TokenCipher;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** UserService 단위 테스트 (DB·Docker 불필요, Mockito). */
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock UserRepository userRepository;
    @Mock UserSettingsRepository settingsRepository;
    @Mock GitHubClient gitHubClient;
    @Mock TokenCipher tokenCipher;

    @InjectMocks UserService userService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User(42L, "octocat", "https://avatars/old.png", "enc-token");
    }

    /** 프로필 로드/저장 stub (managed 엔티티 조회 후 저장하는 흐름에서만 사용). */
    private void stubUserPersistence() {
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void 프로필_수정은_표시이름과_이메일을_갱신한다() {
        stubUserPersistence();
        UserProfileDto result = userService.updateProfile(
            user, new UpdateProfileRequest("Octo Cat", "octo@example.com"));

        assertThat(result.displayName()).isEqualTo("Octo Cat");
        assertThat(result.email()).isEqualTo("octo@example.com");
    }

    @Test
    void 빈문자열은_값해제로_저장하고_null필드는_미변경한다() {
        stubUserPersistence();
        user.setDisplayName("기존이름");
        user.setEmail("keep@example.com");

        // displayName은 빈 문자열(해제), email은 null(미변경)
        UserProfileDto result = userService.updateProfile(
            user, new UpdateProfileRequest("", null));

        // displayName 해제 → login으로 대체 노출
        assertThat(result.displayName()).isEqualTo("octocat");
        assertThat(result.email()).isEqualTo("keep@example.com");
    }

    @Test
    void 재동기화는_GitHub의_login과_avatar만_갱신하고_편집필드는_보존한다() {
        stubUserPersistence();
        user.setDisplayName("내가정한이름");
        when(tokenCipher.decrypt("enc-token")).thenReturn("plain-token");
        when(gitHubClient.getCurrentUser("plain-token"))
            .thenReturn(new GitHubClient.GitHubUser(42L, "octocat-new", "https://avatars/new.png"));

        UserProfileDto result = userService.resyncFromGitHub(user);

        assertThat(result.login()).isEqualTo("octocat-new");
        assertThat(result.avatarUrl()).isEqualTo("https://avatars/new.png");
        assertThat(result.displayName()).isEqualTo("내가정한이름"); // 편집 필드 보존
    }

    @Test
    void 설정_수정은_지정한_필드만_갱신한다() {
        UserSettings settings = new UserSettings(user.getId());
        when(settingsRepository.findById(user.getId())).thenReturn(Optional.of(settings));
        when(settingsRepository.save(any(UserSettings.class))).thenAnswer(inv -> inv.getArgument(0));

        UserSettingsDto result = userService.updateSettings(
            user, new UpdateSettingsRequest(Severity.HIGH, List.of("dist/**"), null));

        assertThat(result.minSeverity()).isEqualTo(Severity.HIGH);
        assertThat(result.excludedPaths()).containsExactly("dist/**");
        assertThat(result.notifyEmail()).isFalse(); // null → 미변경(기본값 유지)
    }

    @Test
    void 설정_조회시_없으면_기본값으로_생성한다() {
        UUID id = user.getId();
        when(settingsRepository.findById(id)).thenReturn(Optional.empty());
        when(settingsRepository.save(any(UserSettings.class))).thenAnswer(inv -> inv.getArgument(0));

        UserSettingsDto result = userService.getSettings(user);

        assertThat(result.minSeverity()).isEqualTo(Severity.LOW);
        assertThat(result.excludedPaths()).isEmpty();
        verify(settingsRepository).save(any(UserSettings.class));
    }

    @Test
    void 탈퇴는_사용자행을_삭제한다() {
        userService.deleteAccount(user);

        verify(userRepository).deleteById(user.getId());
        verify(gitHubClient, never()).getCurrentUser(any());
    }
}
