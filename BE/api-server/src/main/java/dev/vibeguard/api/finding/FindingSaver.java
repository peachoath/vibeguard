package dev.vibeguard.api.finding;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Finding INSERT를 독립 트랜잭션(TransactionTemplate REQUIRES_NEW)으로 실행.
 *
 * @Transactional(REQUIRES_NEW) 는 메서드가 정상 반환된 후 commit을 시도할 때
 * JDBC 제약 위반으로 롤백-온리가 된 tx를 commit하려다 UnexpectedRollbackException을 던져
 * 외부 트랜잭션까지 오염시킨다. TransactionTemplate.execute()는 콜백 예외를 받는 즉시
 * 롤백 후 재던지므로, 외부에서 DataIntegrityViolationException을 잡으면 깔끔하게 처리된다.
 */
@Component
public class FindingSaver {

    private static final Logger log = LoggerFactory.getLogger(FindingSaver.class);

    private final FindingRepository repo;
    private final TransactionTemplate txRequiresNew;

    public FindingSaver(FindingRepository repo, PlatformTransactionManager tm) {
        this.repo = repo;
        this.txRequiresNew = new TransactionTemplate(tm);
        this.txRequiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void saveIgnoreDuplicate(Finding finding) {
        try {
            txRequiresNew.execute(status -> {
                repo.saveAndFlush(finding);
                return null;
            });
        } catch (DataIntegrityViolationException ex) {
            log.debug("[finding-saver] 중복 finding 무시 scanId={}", finding.getScanId());
        }
    }
}
