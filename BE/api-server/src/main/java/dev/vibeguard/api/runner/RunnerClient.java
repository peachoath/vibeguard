package dev.vibeguard.api.runner;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * API Server → Agent Runner 작업 위임 클라이언트 (PRD §5.2).
 * 런너의 POST /scans 로 스캔 작업을 넘긴다. 요청 본문에 HMAC 서명을 붙여 무결성 확보(NFR-S4).
 */
@Component
public class RunnerClient {

    private static final Logger log = LoggerFactory.getLogger(RunnerClient.class);

    private final RestClient restClient;
    private final HmacSigner hmacSigner;
    private final ObjectMapper objectMapper;

    public RunnerClient(@Value("${vibeguard.runner.base-url}") String baseUrl,
                        HmacSigner hmacSigner,
                        ObjectMapper objectMapper) {
        this.restClient = RestClient.builder().baseUrl(baseUrl).build();
        this.hmacSigner = hmacSigner;
        this.objectMapper = objectMapper;
    }

    /**
     * 런너에 스캔 작업 위임. 실패 시 예외를 던지므로 호출부(오케스트레이터)에서
     * 스캔을 FAILED 처리하도록 한다.
     */
    public void delegateScan(String scanId, String repoUrl, String ref) {
        Map<String, Object> body = Map.of(
            "scanId", scanId,
            "repoUrl", repoUrl,
            "ref", ref == null ? "" : ref);

        byte[] rawBody = serialize(body);
        String signature = hmacSigner.sign(rawBody);
        String timestamp = String.valueOf(System.currentTimeMillis());

        restClient.post()
            .uri("/scans")
            .header("Content-Type", "application/json")
            .header("X-VibeGuard-Signature", signature)
            .header("X-VibeGuard-Timestamp", timestamp)
            .body(rawBody)
            .retrieve()
            .toBodilessEntity();

        log.info("[runner-client] 스캔 위임 완료 scanId={} ref={}", scanId, ref);
    }

    private byte[] serialize(Map<String, Object> body) {
        try {
            return objectMapper.writeValueAsBytes(body);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("런너 위임 본문 직렬화 실패", ex);
        }
    }
}
