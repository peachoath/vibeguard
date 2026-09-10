package dev.vibeguard.api.scan;

import dev.vibeguard.api.runner.RunnerEvent;
import dev.vibeguard.api.runner.RunnerEventHandler;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * 런너 콜백 이벤트를 스캔 상태머신에 반영 (PRD §6.1).
 * kind=stage → 해당 단계 상태로 전이, kind=done → 최종 상태 반영.
 * SSE 브로드캐스트는 후속 태스크(#5)에서 이 핸들러에 추가한다.
 */
@Component
public class ScanEventHandler implements RunnerEventHandler {

    private static final Logger log = LoggerFactory.getLogger(ScanEventHandler.class);

    private final ScanService scanService;

    public ScanEventHandler(ScanService scanService) {
        this.scanService = scanService;
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
            case "log", "finding" -> {
                // #5(SSE)·#6(finding 저장)에서 처리 확장. 현재는 무시.
            }
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
    }

    private void handleDone(UUID scanId, RunnerEvent event) {
        ScanStatus status = toStatus(event.status());
        // done 이벤트의 status가 비었거나 매핑 불가하면 안전하게 COMPLETED로 간주하지 않고 경고만.
        if (status == null) {
            log.warn("[scan-event] done 이벤트 status 매핑 불가={} scanId={}", event.status(), scanId);
            return;
        }
        scanService.updateStatus(scanId, status);
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
