package dev.vibeguard.api;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * 통합 테스트용 PostgreSQL 16 컨테이너 (PRD §12).
 * @ServiceConnection이 datasource(url/user/pw)를 자동 주입하므로,
 * 실제 컨테이너에 Flyway V1+V2 마이그레이션이 적용되고 JPA validate가 검증된다.
 * 실행에는 Docker가 필요하다.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    PostgreSQLContainer<?> postgresContainer() {
        return new PostgreSQLContainer<>(DockerImageName.parse("postgres:16"));
    }
}
