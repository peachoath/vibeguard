package dev.vibeguard.api.finding;

import dev.vibeguard.api.patch.TestPhase;
import java.util.List;
import java.util.UUID;

/**
 * TDD 증거 응답 (PRD §9 EvidenceDto, F-07).
 * 최신(또는 대표) 패치의 재현 테스트 코드와 phase별 실행 결과.
 * FREE 플랜 등 TDD 미수행 Finding은 phases가 비어 있을 수 있다.
 */
public record EvidenceDto(
    UUID findingId,
    String testCode,
    List<Phase> phases,
    int attempts
) {
    /** phase별 실행 결과 (PRE_PATCH/POST_PATCH/REGRESSION). */
    public record Phase(
        TestPhase phase,
        boolean passed,
        Integer total,
        Integer failed,
        String log
    ) {
    }
}
