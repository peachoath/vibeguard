package dev.vibeguard.api;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * 컨텍스트 로드 스모크 테스트.
 * <p>실행에는 Docker(Testcontainers PostgreSQL)가 필요합니다.
 * DB 컨테이너 구성은 {@code TestcontainersConfiguration} 추가 후 활성화하세요.
 */
@SpringBootTest
@ActiveProfiles("test")
class ApiServerApplicationTests {

    @Test
    void contextLoads() {
    }
}
