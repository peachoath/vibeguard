package dev.vibeguard.api.patch;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Patch를 독립 트랜잭션(REQUIRES_NEW)으로 저장한다.
 * TestRunSaver가 FK patch_id를 참조하기 전에 Patch가 커밋되어야 하므로
 * 외부 @Transactional 내에서 직접 save()를 호출하면 안 된다.
 */
@Component
public class PatchSaver {

    private static final Logger log = LoggerFactory.getLogger(PatchSaver.class);

    private final PatchRepository repo;
    private final TransactionTemplate txRequiresNew;

    public PatchSaver(PatchRepository repo, PlatformTransactionManager tm) {
        this.repo = repo;
        this.txRequiresNew = new TransactionTemplate(tm);
        this.txRequiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** Patch를 즉시 커밋하고 저장된 엔티티를 반환한다. 중복 시 DataIntegrityViolationException 재전파. */
    public Patch saveAndReturn(Patch patch) {
        try {
            return txRequiresNew.execute(status -> repo.saveAndFlush(patch));
        } catch (DataIntegrityViolationException ex) {
            log.warn("[patch-saver] Patch 저장 실패 findingId={}: {}", patch.getFindingId(), ex.getMessage());
            throw ex;
        }
    }
}
