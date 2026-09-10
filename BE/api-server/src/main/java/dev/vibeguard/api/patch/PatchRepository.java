package dev.vibeguard.api.patch;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** patches 테이블 접근. */
public interface PatchRepository extends JpaRepository<Patch, UUID> {

    List<Patch> findByFindingIdOrderByAttemptNo(UUID findingId);
}
