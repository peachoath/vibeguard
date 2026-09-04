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

    /** 암호화된 GitHub access token (평문 저장 금지). */
    @Column(name = "access_token", nullable = false)
    private String accessToken;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    public User(Long githubId, String login, String avatarUrl, String accessToken) {
        this.id = UUID.randomUUID();
        this.githubId = githubId;
        this.login = login;
        this.avatarUrl = avatarUrl;
        this.accessToken = accessToken;
    }
}
