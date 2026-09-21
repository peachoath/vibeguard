package dev.vibeguard.api.runner;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.Map;

/**
 * Agent Runner → API 콜백 이벤트 (API Spec §8).
 * kind: stage | log | finding | done. 그 외 필드는 kind에 따라 선택적.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record RunnerEvent(
    String scanId,
    String kind,
    String stage,
    Integer agent,
    String status,
    Map<String, Object> payload
) {
}
