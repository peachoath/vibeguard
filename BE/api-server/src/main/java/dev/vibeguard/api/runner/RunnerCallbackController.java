package dev.vibeguard.api.runner;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Agent Runner → API 콜백 수신 (PRD NFR-S4, API Spec §8).
 * 세션 인증이 아니라 HMAC-SHA256 서명으로만 보호된다(SecurityConfig에서 permitAll).
 *
 * <p>서명 대상은 본문 raw bytes이므로 {@code byte[]}로 받아 검증 후 파싱한다.
 * 서명 불일치 또는 타임스탬프 만료 시 401.
 */
@RestController
@RequestMapping("/api/v1/internal/runner")
public class RunnerCallbackController {

    private static final Logger log = LoggerFactory.getLogger(RunnerCallbackController.class);

    /** 재전송 방지 허용 시간 창: ±5분. */
    private static final long TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000L;

    private final HmacSigner hmacSigner;
    private final ObjectMapper objectMapper;
    private final RunnerEventHandler eventHandler;

    public RunnerCallbackController(HmacSigner hmacSigner, ObjectMapper objectMapper,
                                    RunnerEventHandler eventHandler) {
        this.hmacSigner = hmacSigner;
        this.objectMapper = objectMapper;
        this.eventHandler = eventHandler;
    }

    @PostMapping("/events")
    public ResponseEntity<Void> events(
        @RequestBody byte[] rawBody,
        @RequestHeader(name = "X-VibeGuard-Signature", required = false) String signature,
        @RequestHeader(name = "X-VibeGuard-Timestamp", required = false) String timestamp) {

        if (!isFreshTimestamp(timestamp)) {
            log.warn("[runner-callback] 타임스탬프 누락/만료");
            return ResponseEntity.status(401).build();
        }
        if (!hmacSigner.verify(rawBody, signature)) {
            log.warn("[runner-callback] HMAC 서명 검증 실패");
            return ResponseEntity.status(401).build();
        }

        RunnerEvent event;
        try {
            event = objectMapper.readValue(rawBody, RunnerEvent.class);
        } catch (IOException ex) {
            log.warn("[runner-callback] 본문 파싱 실패: {}", ex.getMessage());
            return ResponseEntity.badRequest().build();
        }

        eventHandler.handle(event);
        return ResponseEntity.noContent().build();
    }

    private boolean isFreshTimestamp(String timestamp) {
        if (timestamp == null || timestamp.isBlank()) {
            return false;
        }
        try {
            long ts = Long.parseLong(timestamp.trim());
            long diff = Math.abs(System.currentTimeMillis() - ts);
            return diff <= TIMESTAMP_TOLERANCE_MS;
        } catch (NumberFormatException ex) {
            return false;
        }
    }
}
