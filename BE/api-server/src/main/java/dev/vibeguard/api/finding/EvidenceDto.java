package dev.vibeguard.api.finding;

import dev.vibeguard.api.patch.TestOutcome;
import dev.vibeguard.api.patch.TestPhase;
import java.util.List;
import java.util.UUID;

/**
 * 회귀 증거 응답 (PRD §9 EvidenceDto, F-07, 방향 전환 v2).
 * 재현 테스트를 만들지 않으므로, 리포의 기존 테스트를 패치 전후로 실행한 결과다.
 * 테스트가 없는 리포(기본 등급/NO_TESTS)는 phases가 비어 있을 수 있다.
 */
public record EvidenceDto(
    UUID findingId,
    List<Phase> phases,
    int attempts
) {
    /** phase별 실행 결과 (PRE_PATCH=기준선 / POST_PATCH=하위 호환 확인). */
    public record Phase(
        TestPhase phase,
        boolean passed,
        Integer exitCode,
        TestOutcome outcome,
        Integer total,
        Integer failed,
        String log
    ) {
    }
}
