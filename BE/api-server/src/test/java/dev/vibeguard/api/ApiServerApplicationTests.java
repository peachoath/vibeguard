package dev.vibeguard.api;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * 컨텍스트 로드 스모크 테스트 (통합).
 * Testcontainers PostgreSQL 16에 Flyway(V1+V2) 마이그레이션이 적용되고,
 * JPA 엔티티가 그 스키마와 일치하는지(ddl-auto=validate) 검증한다.
 * 실행에는 Docker가 필요하다.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ApiServerApplicationTests {

    @Test
    void contextLoads() {
    }
}
