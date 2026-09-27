package dev.vibeguard.api.scan;

import dev.vibeguard.api.runner.RunnerEvent;
import dev.vibeguard.api.runner.RunnerEventHandler;
import dev.vibeguard.api.sse.SseHub;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * 런너 콜백 이벤트를 스캔 상태머신에 반영하고(PRD §6.1) SSE로 브로드캐스트한다(F-04).
 * kind=stage → 해당 단계 상태 전이, kind=done → 최종 상태 반영 후 스트림 종료.
 * kind=log/finding → 상태 변경 없이 구독자에게 그대로 전달(finding 저장은 #6에서 확장).
 */
@Component
public class ScanEventHandler implements RunnerEventHandler {

    private static final Logger log = LoggerFactory.getLogger(ScanEventHandler.class);

    private final ScanService scanService;
    private final SseHub sseHub;

    public ScanEventHandler(ScanService scanService, SseHub sseHub) {
        this.scanService = scanService;
        this.sseHub = sseHub;
    }

    @Override
    public void handle(RunnerEvent event) {
        UUID scanId = parseScanId(event.scanId());
        if (scanId == null) {
            log.warn("[scan-event] 유효하지 않은 scanId: {}", event.scanId());
            return;
        }

        String kind = event.kind() == null ? "" : event.kind();
        switch (kind) {
            case "stage" -> handleStage(scanId, event);
            case "done" -> handleDone(scanId, event);
            case "log", "finding" -> sseHub.broadcast(scanId, kind, toPayload(event));
            default -> log.debug("[scan-event] 처리하지 않는 kind={} scanId={}", kind, scanId);
        }
    }

    private void handleStage(UUID scanId, RunnerEvent event) {
        ScanStatus status = toStatus(event.stage());
        if (status == null) {
            log.warn("[scan-event] 매핑 불가한 stage={} scanId={}", event.stage(), scanId);
            return;
        }
        scanService.updateStatus(scanId, status);
        sseHub.broadcast(scanId, "stage", toPayload(event));
    }

    private void handleDone(UUID scanId, RunnerEvent event) {
        ScanStatus status = toStatus(event.status());
        if (status == null) {
            log.warn("[scan-event] done 이벤트 status 매핑 불가={} scanId={}", event.status(), scanId);
            return;
        }
        scanService.updateStatus(scanId, status);
        sseHub.broadcast(scanId, "done", toPayload(event));
        sseHub.complete(scanId);
    }

    /** SSE로 내보낼 페이로드(원본 이벤트 필드 요약). 토큰·시크릿은 이벤트에 없음(NFR-S3). */
    private Map<String, Object> toPayload(RunnerEvent event) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("scanId", event.scanId());
        m.put("kind", event.kind());
        if (event.stage() != null) {
            m.put("stage", event.stage());
        }
        if (event.agent() != null) {
            m.put("agent", event.agent());
        }
        if (event.status() != null) {
            m.put("status", event.status());
        }
        if (event.payload() != null) {
            m.put("payload", event.payload());
        }
        return m;
    }

    private ScanStatus toStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return ScanStatus.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private UUID parseScanId(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
