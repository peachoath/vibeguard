package dev.vibeguard.api.user;

import dev.vibeguard.api.repository.GitHubClient;
import dev.vibeguard.api.repository.Repositories;
import dev.vibeguard.api.scan.ScanRepository;
import dev.vibeguard.api.security.TokenCipher;
import java.time.OffsetDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 마이페이지 / 계정 관리 도메인 서비스 (이슈 #7, F-01 확장).
 * 프로필 조회·수정, GitHub 프로필 재동기화, 알림/정책 설정, 회원 탈퇴를 담당한다.
 */
@Service
public class UserService {

    private final UserRepository userRepository;
    private final UserSettingsRepository settingsRepository;
    private final GitHubClient gitHubClient;
    private final TokenCipher tokenCipher;
    private final Repositories repositories;
    private final ScanRepository scanRepository;

    public UserService(
            UserRepository userRepository,
            UserSettingsRepository settingsRepository,
            GitHubClient gitHubClient,
            TokenCipher tokenCipher,
            Repositories repositories,
            ScanRepository scanRepository) {
        this.userRepository = userRepository;
        this.settingsRepository = settingsRepository;
        this.gitHubClient = gitHubClient;
        this.tokenCipher = tokenCipher;
        this.repositories = repositories;
        this.scanRepository = scanRepository;
    }

    /** 프로필 조회. */
    public UserProfileDto getProfile(User user) {
        return UserProfileDto.from(user);
    }

    /** 계정 요약 통계 (연결 리포 수·스캔 수). */
    public UserStatsDto getStats(User user) {
        return new UserStatsDto(
            repositories.countByUserId(user.getId()),
            scanRepository.countByUser(user.getId()));
    }

    /**
     * 프로필 수정(부분). null 필드는 미변경, 빈 문자열은 값 해제(null)로 저장한다.
     */
    @Transactional
    public UserProfileDto updateProfile(User user, UpdateProfileRequest req) {
        User managed = userRepository.findById(user.getId()).orElseThrow();
        if (req.displayName() != null) {
            managed.setDisplayName(blankToNull(req.displayName()));
        }
        if (req.email() != null) {
            managed.setEmail(blankToNull(req.email()));
        }
        managed.setUpdatedAt(OffsetDateTime.now());
        return UserProfileDto.from(userRepository.save(managed));
    }

    /**
     * GitHub 프로필(login, avatar_url) 재동기화. 저장된 암호화 토큰을 복호화해 GET /user 를 호출한다.
     * 사용자 편집 필드(displayName, email)는 건드리지 않는다.
     */
    @Transactional
    public UserProfileDto resyncFromGitHub(User user) {
        String token = tokenCipher.decrypt(user.getAccessToken());
        GitHubClient.GitHubUser gh = gitHubClient.getCurrentUser(token);

        User managed = userRepository.findById(user.getId()).orElseThrow();
        if (gh != null) {
            managed.setLogin(gh.login());
            managed.setAvatarUrl(gh.avatarUrl());
            managed.setUpdatedAt(OffsetDateTime.now());
        }
        return UserProfileDto.from(userRepository.save(managed));
    }

    /** 설정 조회. 없으면 기본값으로 생성해 반환(최초 접근 시 lazy 생성). */
    @Transactional
    public UserSettingsDto getSettings(User user) {
        return UserSettingsDto.from(getOrCreateSettings(user.getId()));
    }

    /** 설정 수정(부분). null 필드는 미변경. */
    @Transactional
    public UserSettingsDto updateSettings(User user, UpdateSettingsRequest req) {
        UserSettings settings = getOrCreateSettings(user.getId());
        if (req.minSeverity() != null) {
            settings.setMinSeverity(req.minSeverity());
        }
        if (req.excludedPaths() != null) {
            settings.setExcludedPaths(req.excludedPaths());
        }
        if (req.notifyEmail() != null) {
            settings.setNotifyEmail(req.notifyEmail());
        }
        settings.setUpdatedAt(OffsetDateTime.now());
        return UserSettingsDto.from(settingsRepository.save(settings));
    }

    /**
     * 회원 탈퇴. users 행 삭제 시 FK ON DELETE CASCADE 로
     * repositories → scans → findings/patches/… 및 user_settings 가 함께 제거된다.
     * 세션 무효화는 컨트롤러에서 처리한다.
     */
    @Transactional
    public void deleteAccount(User user) {
        userRepository.deleteById(user.getId());
    }

    private UserSettings getOrCreateSettings(java.util.UUID userId) {
        return settingsRepository.findById(userId)
            .orElseGet(() -> settingsRepository.save(new UserSettings(userId)));
    }

    private static String blankToNull(String s) {
        return s.isBlank() ? null : s.trim();
    }
}
