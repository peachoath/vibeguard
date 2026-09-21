package dev.vibeguard.api.patch;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** test_runs 테이블 접근. */
public interface TestRunRepository extends JpaRepository<TestRun, UUID> {

    List<TestRun> findByPatchIdOrderByCreatedAt(UUID patchId);
}
