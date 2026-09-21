package dev.vibeguard.api.runner;

/**
 * 검증된 런너 콜백 이벤트의 후속 처리 지점.
 * #4(스캔 상태머신 갱신)·#5(SSE 브로드캐스트)에서 구현이 확장된다.
 */
public interface RunnerEventHandler {

    void handle(RunnerEvent event);
}
