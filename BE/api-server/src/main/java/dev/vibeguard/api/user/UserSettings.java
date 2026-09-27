package dev.vibeguard.api.user;

import dev.vibeguard.api.finding.Severity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * user_settings 테이블 (이슈 #7). 사용자별 알림/정책 기본값.
 * PK 가 곧 users(id) FK 이며(1:1), 회원 탈퇴 시 DB CASCADE 로 함께 삭제된다.
 */
@Entity
@Table(name = "user_settings")
@Getter
@Setter
@NoArgsConstructor
public class UserSettings {

    @Id
    @Column(name = "user_id", columnDefinition = "uuid")
    private UUID userId;

    /** 대시보드/알림에서 노출할 최소 심각도 임계값 (F-15). */
    @Enumerated(EnumType.STRING)
    @Column(name = "min_severity", nullable = false)
    private Severity minSeverity = Severity.LOW;

    /** 스캔 제외 glob 경로 목록 (JSONB). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "excluded_paths", nullable = false, columnDefinition = "jsonb")
    private List<String> excludedPaths = new ArrayList<>();

    @Column(name = "notify_email", nullable = false)
    private boolean notifyEmail = false;

    @Column(name = "updated_at", insertable = false)
    private OffsetDateTime updatedAt;

    /** 사용자별 기본 설정 생성(모든 값 기본값). */
    public UserSettings(UUID userId) {
        this.userId = userId;
    }
}
