package dev.vibeguard.api.patch;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * TestRun INSERT를 독립 트랜잭션(TransactionTemplate REQUIRES_NEW)으로 실행.
 * uq_testrun_patch_phase 위반 시 해당 트랜잭션만 롤백 — 외부 트랜잭션 오염 방지.
 * FindingSaver와 동일한 패턴 (REQUIRES_NEW + TransactionTemplate).
 */
@Component
public class TestRunSaver {

    private static final Logger log = LoggerFactory.getLogger(TestRunSaver.class);

    private final TestRunRepository repo;
    private final TransactionTemplate txRequiresNew;

    public TestRunSaver(TestRunRepository repo, PlatformTransactionManager tm) {
        this.repo = repo;
        this.txRequiresNew = new TransactionTemplate(tm);
        this.txRequiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void saveIgnoreDuplicate(TestRun testRun) {
        try {
            txRequiresNew.execute(status -> {
                repo.saveAndFlush(testRun);
                return null;
            });
        } catch (DataIntegrityViolationException ex) {
            log.debug("[testrun-saver] 중복 TestRun 무시 patchId={} phase={}",
                testRun.getPatchId(), testRun.getPhase());
        }
    }
}
