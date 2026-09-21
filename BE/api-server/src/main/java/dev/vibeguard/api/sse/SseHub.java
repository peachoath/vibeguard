package dev.vibeguard.api.sse;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 스캔 진행 SSE 허브 (PRD §9.1, F-04).
 * scanId별로 구독 SseEmitter 목록을 관리하고, 런너 콜백 이벤트를 구독자에게 브로드캐스트한다.
 * 연결 30분 유지(NFR-P3), 완료/타임아웃/에러 시 자동 정리.
 */
@Component
public class SseHub {

    private static final Logger log = LoggerFactory.getLogger(SseHub.class);

    /** SSE 연결 타임아웃 30분 (NFR-P3). 클라이언트는 지수 백오프로 재연결. */
    private static final long TIMEOUT_MS = 30 * 60 * 1000L;

    private final Map<UUID, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

    /** 특정 스캔 진행 스트림 구독. */
    public SseEmitter subscribe(UUID scanId) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        emitters.computeIfAbsent(scanId, k -> new CopyOnWriteArrayList<>()).add(emitter);

        emitter.onCompletion(() -> remove(scanId, emitter));
        emitter.onTimeout(() -> {
            emitter.complete();
            remove(scanId, emitter);
        });
        emitter.onError(e -> remove(scanId, emitter));

        // 최초 연결 확인용 코멘트성 이벤트(선택). 실패해도 무시.
        try {
            emitter.send(SseEmitter.event().name("open").data("{\"scanId\":\"" + scanId + "\"}"));
        } catch (IOException e) {
            remove(scanId, emitter);
        }
        return emitter;
    }

    /** 지정 스캔 구독자 전원에게 이벤트 전송. */
    public void broadcast(UUID scanId, String eventName, Object data) {
        List<SseEmitter> list = emitters.get(scanId);
        if (list == null || list.isEmpty()) {
            return;
        }
        for (SseEmitter emitter : list) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(data));
            } catch (IOException | IllegalStateException ex) {
                log.debug("[sse] 전송 실패 — 구독 제거 scanId={} event={}", scanId, eventName);
                remove(scanId, emitter);
            }
        }
    }

    /** 스캔 종료 시 구독자 모두 완료 처리. */
    public void complete(UUID scanId) {
        List<SseEmitter> list = emitters.remove(scanId);
        if (list == null) {
            return;
        }
        for (SseEmitter emitter : list) {
            try {
                emitter.complete();
            } catch (Exception ignore) {
                // 이미 닫힌 경우 무시
            }
        }
    }

    private void remove(UUID scanId, SseEmitter emitter) {
        List<SseEmitter> list = emitters.get(scanId);
        if (list != null) {
            list.remove(emitter);
            if (list.isEmpty()) {
                emitters.remove(scanId, list);
            }
        }
    }
}
