package dev.vibeguard.api.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** users 테이블 (PRD §10). GitHub access_token은 AES-256-GCM 암호화 저장(NFR-S3). */
@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "github_id", nullable = false, unique = true)
    private Long githubId;

    @Column(nullable = false)
    private String login;

    @Column(name = "avatar_url")
    private String avatarUrl;

    /** 사용자가 직접 편집하는 표시 이름. 미설정 시 login 을 대체로 사용(응답 계층에서 처리). */
    @Column(name = "display_name")
    private String displayName;

    /** 사용자가 직접 편집하는 연락용 이메일. GitHub 이메일과 무관하게 관리한다. */
    @Column(name = "email")
    private String email;

    /** 암호화된 GitHub access token (평문 저장 금지). */
    @Column(name = "access_token", nullable = false)
    private String accessToken;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    /** 프로필/토큰 갱신 시각. INSERT 시 DB 기본값(now()), UPDATE 시 서비스에서 갱신. */
    @Column(name = "updated_at", insertable = false)
    private OffsetDateTime updatedAt;

    /** 마지막 로그인(OAuth 성공) 시각. 로그인 시마다 갱신. */
    @Column(name = "last_login_at")
    private OffsetDateTime lastLoginAt;

    public User(Long githubId, String login, String avatarUrl, String accessToken) {
        this.id = UUID.randomUUID();
        this.githubId = githubId;
        this.login = login;
        this.avatarUrl = avatarUrl;
        this.accessToken = accessToken;
    }
}
