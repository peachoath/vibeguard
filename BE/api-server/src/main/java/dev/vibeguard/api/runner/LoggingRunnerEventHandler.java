package dev.vibeguard.api.runner;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * 기본 이벤트 핸들러 — 수신 이벤트를 로깅한다.
 * 스캔 상태 갱신·SSE 브로드캐스트는 후속 태스크(#4/#5)에서 별도 핸들러/오케스트레이터로 확장.
 * 시크릿·토큰은 이벤트에 실리지 않으므로 로깅해도 안전(NFR-S3).
 */
@Component
public class LoggingRunnerEventHandler implements RunnerEventHandler {

    private static final Logger log = LoggerFactory.getLogger(LoggingRunnerEventHandler.class);

    @Override
    public void handle(RunnerEvent event) {
        log.info("[runner-event] scanId={} kind={} stage={} agent={} status={}",
            event.scanId(), event.kind(), event.stage(), event.agent(), event.status());
    }
}
