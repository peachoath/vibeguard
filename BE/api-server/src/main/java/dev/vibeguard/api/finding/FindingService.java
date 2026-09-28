package dev.vibeguard.api.finding;

import dev.vibeguard.api.common.NotFoundException;
import dev.vibeguard.api.patch.Patch;
import dev.vibeguard.api.patch.PatchRepository;
import dev.vibeguard.api.patch.TestRun;
import dev.vibeguard.api.patch.TestRunRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Finding 조회/상세/무시/증거/Diff 도메인 서비스 (F-05~F-08, F-12). */
@Service
public class FindingService {

    private final FindingRepository findingRepository;
    private final PatchRepository patchRepository;
    private final TestRunRepository testRunRepository;

    public FindingService(FindingRepository findingRepository, PatchRepository patchRepository,
                          TestRunRepository testRunRepository) {
        this.findingRepository = findingRepository;
        this.patchRepository = patchRepository;
        this.testRunRepository = testRunRepository;
    }

    /**
     * Finding 목록 — 스캔 소유권 사전 검증 포함 (IDOR 방지).
     * 스캔이 존재하지 않거나 소유권 없는 경우 404.
     */
    @Transactional(readOnly = true)
    public Page<FindingDto> list(UUID scanId, UUID userId, Severity severity, FindingType type,
                                 FindingStatus status, Pageable pageable) {
        if (!findingRepository.isScanOwnedByUser(scanId, userId)) {
            throw new NotFoundException("스캔을 찾을 수 없습니다: " + scanId);
        }
        return findingRepository.search(scanId, severity, type, status, pageable)
            .map(FindingDto::from);
    }

    @Transactional(readOnly = true)
    public FindingDetailDto detail(UUID findingId, UUID userId) {
        return FindingDetailDto.from(requireForUser(findingId, userId));
    }

    /** 오탐 처리 — status를 IGNORED로. rationale에 사유를 병기(기록 보존). 소유권 검증 포함. */
    @Transactional
    public FindingDto ignore(UUID findingId, UUID userId, String reason) {
        Finding f = requireForUser(findingId, userId);
        f.setStatus(FindingStatus.IGNORED);
        String note = "[IGNORED] " + reason;
        f.setRationale(f.getRationale() == null ? note : f.getRationale() + "\n" + note);
        return FindingDto.from(f);
    }

    /** 회귀 증거 — 최신 attempt 패치의 phase별 실행 결과. 소유권 검증 포함. */
    @Transactional(readOnly = true)
    public EvidenceDto evidence(UUID findingId, UUID userId) {
        requireForUser(findingId, userId);
        List<Patch> patches = patchRepository.findByFindingIdOrderByAttemptNo(findingId);
        if (patches.isEmpty()) {
            return new EvidenceDto(findingId, List.of(), 0);
        }
        Patch latest = patches.get(patches.size() - 1);
        List<EvidenceDto.Phase> phases = new ArrayList<>();
        for (TestRun tr : testRunRepository.findByPatchIdOrderByCreatedAt(latest.getId())) {
            phases.add(new EvidenceDto.Phase(
                tr.getPhase(), tr.isPassed(), tr.getExitCode(), tr.getOutcome(),
                tr.getTotal(), tr.getFailed(), tr.getLog()));
        }
        return new EvidenceDto(findingId, phases, patches.size());
    }

    /** 패치 diff — 최신 attempt 패치의 매니페스트 변경. 소유권 검증 포함. */
    @Transactional(readOnly = true)
    public DiffDto diff(UUID findingId, UUID userId) {
        Finding f = requireForUser(findingId, userId);
        List<Patch> patches = patchRepository.findByFindingIdOrderByAttemptNo(findingId);
        if (patches.isEmpty()) {
            throw new NotFoundException("패치가 없는 Finding입니다: " + findingId);
        }
        Patch latest = patches.get(patches.size() - 1);
        String path = f.getManifestPath() != null ? f.getManifestPath() : f.getFilePath();
        return new DiffDto(findingId, "unified", path, latest.getDiff());
    }

    /** 내부 전용 단순 조회 — 런너 이벤트 핸들러 등 사용자 컨텍스트 없는 경로용. */
    Finding require(UUID findingId) {
        return findingRepository.findById(findingId)
            .orElseThrow(() -> new NotFoundException("Finding을 찾을 수 없습니다: " + findingId));
    }

    /**
     * 소유권 검증 조회 — 사용자 대면 API용 (IDOR 방지).
     * 존재하지 않거나 소유권 없는 경우 동일하게 404 반환하여 존재 여부를 노출하지 않는다.
     */
    private Finding requireForUser(UUID findingId, UUID userId) {
        return findingRepository.findByIdAndUserId(findingId, userId)
            .orElseThrow(() -> new NotFoundException("Finding을 찾을 수 없습니다: " + findingId));
    }
}
