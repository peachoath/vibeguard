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

    @Transactional(readOnly = true)
    public Page<FindingDto> list(UUID scanId, Severity severity, FindingType type,
                                 FindingStatus status, Pageable pageable) {
        return findingRepository.search(scanId, severity, type, status, pageable)
            .map(FindingDto::from);
    }

    @Transactional(readOnly = true)
    public FindingDetailDto detail(UUID findingId) {
        return FindingDetailDto.from(require(findingId));
    }

    /** 오탐 처리 — status를 IGNORED로. rationale에 사유를 병기(기록 보존). */
    @Transactional
    public FindingDto ignore(UUID findingId, String reason) {
        Finding f = require(findingId);
        f.setStatus(FindingStatus.IGNORED);
        String note = "[IGNORED] " + reason;
        f.setRationale(f.getRationale() == null ? note : f.getRationale() + "\n" + note);
        return FindingDto.from(f);
    }

    /** TDD 증거 — 최신 attempt 패치의 테스트 코드 + phase별 실행 결과. */
    @Transactional(readOnly = true)
    public EvidenceDto evidence(UUID findingId) {
        require(findingId);
        List<Patch> patches = patchRepository.findByFindingIdOrderByAttemptNo(findingId);
        if (patches.isEmpty()) {
            // TDD 미수행(FREE 등) — 빈 증거
            return new EvidenceDto(findingId, null, List.of(), 0);
        }
        Patch latest = patches.get(patches.size() - 1);
        List<EvidenceDto.Phase> phases = new ArrayList<>();
        for (TestRun tr : testRunRepository.findByPatchIdOrderByCreatedAt(latest.getId())) {
            phases.add(new EvidenceDto.Phase(tr.getPhase(), tr.isPassed(), tr.getTotal(), tr.getFailed(), tr.getLog()));
        }
        return new EvidenceDto(findingId, latest.getTestCode(), phases, patches.size());
    }

    /** 패치 diff — 최신 attempt 패치의 diff. */
    @Transactional(readOnly = true)
    public DiffDto diff(UUID findingId) {
        Finding f = require(findingId);
        List<Patch> patches = patchRepository.findByFindingIdOrderByAttemptNo(findingId);
        if (patches.isEmpty()) {
            throw new NotFoundException("패치가 없는 Finding입니다: " + findingId);
        }
        Patch latest = patches.get(patches.size() - 1);
        return new DiffDto(findingId, "unified", f.getFilePath(), latest.getDiff());
    }

    private Finding require(UUID findingId) {
        return findingRepository.findById(findingId)
            .orElseThrow(() -> new NotFoundException("Finding을 찾을 수 없습니다: " + findingId));
    }
}
