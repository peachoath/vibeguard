package dev.vibeguard.api.user;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** user_settings 테이블 접근. PK = users(id). */
public interface UserSettingsRepository extends JpaRepository<UserSettings, UUID> {
}
