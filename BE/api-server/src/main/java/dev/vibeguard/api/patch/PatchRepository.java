package dev.vibeguard.api.patch;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** patches 테이블 접근. */
public interface PatchRepository extends JpaRepository<Patch, UUID> {

    List<Patch> findByFindingIdOrderByAttemptNo(UUID findingId);

    /** 가장 최근 attempt 패치 조회 — REGRESSION_CHECK 콜백에서 기존 패치 재사용 시 사용. */
    java.util.Optional<Patch> findFirstByFindingIdOrderByAttemptNoDesc(UUID findingId);
}
