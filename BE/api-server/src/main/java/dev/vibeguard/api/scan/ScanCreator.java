package dev.vibeguard.api.scan;

import dev.vibeguard.api.common.ConflictException;
import dev.vibeguard.api.common.NotFoundException;
import dev.vibeguard.api.repository.Repositories;
import dev.vibeguard.api.repository.Repository;
import dev.vibeguard.api.user.User;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 스캔 생성 전용 트랜잭션 경계.
 * ScanService.startScan(논트랜잭션)에서 이 빈을 호출해 생성만 커밋한 뒤 런너 위임을 진행한다
 * (자기호출 시 @Transactional 프록시가 적용되지 않는 함정을 피하기 위한 분리).
 */
@Component
public class ScanCreator {

    private final ScanRepository scanRepository;
    private final Repositories repositories;

    public ScanCreator(ScanRepository scanRepository, Repositories repositories) {
        this.scanRepository = scanRepository;
        this.repositories = repositories;
    }

    /** 소유권·중복 검증 후 QUEUED 스캔을 저장한다. */
    @Transactional
    public Scan createQueued(User user, CreateScanRequest req) {
        Repository repo = repositories.findById(req.repositoryId())
            .orElseThrow(() -> new NotFoundException("리포지토리를 찾을 수 없습니다: " + req.repositoryId()));
        if (!repo.getUserId().equals(user.getId())) {
            // 타 사용자의 리포는 존재를 노출하지 않기 위해 NotFound로 처리
            throw new NotFoundException("리포지토리를 찾을 수 없습니다: " + req.repositoryId());
        }
        if (scanRepository.existsByRepositoryIdAndRefAndStatusIn(
                req.repositoryId(), req.ref(), ScanStatus.activeStatuses())) {
            throw new ConflictException("해당 리포지토리·브랜치의 스캔이 이미 진행 중입니다.");
        }
        return scanRepository.save(new Scan(req.repositoryId(), req.ref()));
    }
}
