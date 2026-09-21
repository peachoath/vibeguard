package dev.vibeguard.api.scan;

import dev.vibeguard.api.common.ConflictException;
import dev.vibeguard.api.common.NotFoundException;
import dev.vibeguard.api.repository.Repositories;
import dev.vibeguard.api.repository.Repository;
import dev.vibeguard.api.runner.RunnerClient;
import dev.vibeguard.api.user.User;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 스캔 오케스트레이션 (PRD §5.1, §6.1 상태머신).
 * 스캔을 생성해 QUEUED로 저장한 뒤 Agent Runner에 작업을 위임한다.
 * 실제 파이프라인 진행/상태 전이는 런너 콜백(RunnerEventHandler)이 반영한다.
 *
 * <p>트랜잭션 경계 주의: 스캔 생성(커밋)과 런너 위임(네트워크 I/O)을 분리하기 위해
 * 생성은 별도 빈 {@link ScanCreator}에 위임한다(자기호출 AOP 미적용 함정 회피).
 */
@Service
public class ScanService {

    private static final Logger log = LoggerFactory.getLogger(ScanService.class);

    private final ScanRepository scanRepository;
    private final Repositories repositories;
    private final RunnerClient runnerClient;
    private final ScanCreator scanCreator;

    public ScanService(ScanRepository scanRepository, Repositories repositories,
                       RunnerClient runnerClient, ScanCreator scanCreator) {
        this.scanRepository = scanRepository;
        this.repositories = repositories;
        this.runnerClient = runnerClient;
        this.scanCreator = scanCreator;
    }

    /**
     * 스캔 생성(트랜잭션 커밋) 후 런너 위임. 위임 실패 시 스캔을 FAILED로 표시한다.
     */
    public Scan startScan(User user, CreateScanRequest req) {
        Scan scan = scanCreator.createQueued(user, req);
        Repository repo = repositories.findById(req.repositoryId())
            .orElseThrow(() -> new NotFoundException("리포지토리를 찾을 수 없습니다: " + req.repositoryId()));

        try {
            String repoUrl = "https://github.com/" + repo.getFullName() + ".git";
            runnerClient.delegateScan(scan.getId().toString(), repoUrl, scan.getRef());
        } catch (Exception ex) {
            log.error("[scan] 런너 위임 실패 scanId={} — FAILED 처리", scan.getId(), ex);
            markFailed(scan.getId(), "RUNNER_DELEGATION_FAILED");
        }
        return scan;
    }

    @Transactional(readOnly = true)
    public Scan get(UUID scanId) {
        return scanRepository.findById(scanId)
            .orElseThrow(() -> new NotFoundException("스캔을 찾을 수 없습니다: " + scanId));
    }

    /** 스캔 취소 — 진행 중일 때만 가능. 종료 상태면 409. */
    @Transactional
    public void cancel(UUID scanId) {
        Scan scan = get(scanId);
        if (scan.getStatus().isTerminal()) {
            throw new ConflictException("이미 종료된 스캔은 취소할 수 없습니다.");
        }
        scan.setStatus(ScanStatus.FAILED);
        scan.setErrorCode("CANCELLED");
        scan.setFinishedAt(OffsetDateTime.now());
    }

    /** 런너 콜백에서 상태 전이를 반영. */
    @Transactional
    public void updateStatus(UUID scanId, ScanStatus status) {
        Scan scan = scanRepository.findById(scanId)
            .orElseThrow(() -> new NotFoundException("스캔을 찾을 수 없습니다: " + scanId));
        applyTransition(scan, status);
    }

    @Transactional
    public void markFailed(UUID scanId, String errorCode) {
        scanRepository.findById(scanId).ifPresent(scan -> {
            scan.setStatus(ScanStatus.FAILED);
            scan.setErrorCode(errorCode);
            scan.setFinishedAt(OffsetDateTime.now());
        });
    }

    private void applyTransition(Scan scan, ScanStatus next) {
        if (scan.getStatus().isTerminal()) {
            log.warn("[scan] 종료 상태 {} 에서 {} 로 전이 시도 무시 scanId={}",
                scan.getStatus(), next, scan.getId());
            return;
        }
        if (scan.getStartedAt() == null && next != ScanStatus.QUEUED) {
            scan.setStartedAt(OffsetDateTime.now());
        }
        scan.setStatus(next);
        if (next.isTerminal()) {
            OffsetDateTime now = OffsetDateTime.now();
            scan.setFinishedAt(now);
            if (scan.getStartedAt() != null) {
                scan.setDurationMs(Duration.between(scan.getStartedAt(), now).toMillis());
            }
        }
    }
}
