package dev.vibeguard.api.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

/**
 * BE/api-server/.env 를 읽어 환경에 주입하는 경량 로더 (개발 편의).
 *
 * <p>우선순위는 낮게(addLast) 둡니다 — 실제 OS 환경변수/CI 설정이 항상 .env를
 * 덮어씁니다. .env가 없으면 조용히 스킵하므로 운영 환경에도 안전합니다.
 *
 * <p>등록: {@code META-INF/spring/org.springframework.boot.env.EnvironmentPostProcessor.imports}
 */
public class DotenvEnvironmentPostProcessor implements EnvironmentPostProcessor {

    private static final String SOURCE_NAME = "dotenvFile";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        Path envPath = Path.of(System.getProperty("user.dir"), ".env");
        if (!Files.isRegularFile(envPath)) {
            return;
        }

        Map<String, Object> values = new HashMap<>();
        try {
            List<String> lines = Files.readAllLines(envPath);
            for (String raw : lines) {
                String line = raw.strip();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                if (line.startsWith("export ")) {
                    line = line.substring("export ".length()).strip();
                }
                int eq = line.indexOf('=');
                if (eq <= 0) {
                    continue;
                }
                String key = line.substring(0, eq).strip();
                String value = line.substring(eq + 1).strip();
                if (value.length() >= 2
                        && ((value.startsWith("\"") && value.endsWith("\""))
                            || (value.startsWith("'") && value.endsWith("'")))) {
                    value = value.substring(1, value.length() - 1);
                }
                values.put(key, value);
            }
        } catch (IOException ex) {
            return;
        }

        if (!values.isEmpty()) {
            environment.getPropertySources().addLast(new MapPropertySource(SOURCE_NAME, values));
        }
    }
}
