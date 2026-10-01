package dev.vibeguard.api.dashboard;

import dev.vibeguard.api.pr.PullRequest;
import dev.vibeguard.api.pr.PullRequestRepository;
import dev.vibeguard.api.repository.GitHubClient;
import dev.vibeguard.api.repository.Repositories;
import dev.vibeguard.api.repository.Repository;
import dev.vibeguard.api.security.TokenCipher;
import dev.vibeguard.api.user.UserRepository;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/** DB 기록과 실제 GitHub 상태를 합쳐 VibeGuard가 생성한 PR 수를 집계한다. */
@Slf4j
@Service
public class GeneratedPullRequestCounter {

    private static final long CACHE_TTL_NANOS = TimeUnit.MINUTES.toNanos(1);

    private final PullRequestRepository pullRequestRepository;
    private final Repositories repositories;
    private final UserRepository userRepository;
    private final GitHubClient gitHubClient;
    private final TokenCipher tokenCipher;
    private volatile long cachedCount;
    private volatile long cacheExpiresAt;

    public GeneratedPullRequestCounter(
            PullRequestRepository pullRequestRepository,
            Repositories repositories,
            UserRepository userRepository,
            GitHubClient gitHubClient,
            TokenCipher tokenCipher) {
        this.pullRequestRepository = pullRequestRepository;
        this.repositories = repositories;
        this.userRepository = userRepository;
        this.gitHubClient = gitHubClient;
        this.tokenCipher = tokenCipher;
    }

    public long count() {
        long now = System.nanoTime();
        if (now < cacheExpiresAt) {
            return cachedCount;
        }
        synchronized (this) {
            if (now < cacheExpiresAt) {
                return cachedCount;
            }
            cachedCount = countFresh();
            cacheExpiresAt = System.nanoTime() + CACHE_TTL_NANOS;
            return cachedCount;
        }
    }

    private long countFresh() {
        Set<String> pullRequestUrls = new HashSet<>();
        long persistedWithoutUrl = 0;
        for (PullRequest pullRequest : pullRequestRepository.findAll()) {
            if (pullRequest.getUrl() == null || pullRequest.getUrl().isBlank()) {
                persistedWithoutUrl++;
            } else {
                pullRequestUrls.add(pullRequest.getUrl());
            }
        }

        Set<String> checkedRepositories = new HashSet<>();
        List<RepositoryAccess> repositoryAccesses = new ArrayList<>();
        for (Repository repository : repositories.findAll()) {
            if (!checkedRepositories.add(repository.getFullName())) {
                continue;
            }
            userRepository.findById(repository.getUserId()).ifPresent(user -> {
                try {
                    String accessToken = tokenCipher.decrypt(user.getAccessToken());
                    repositoryAccesses.add(new RepositoryAccess(repository.getFullName(), accessToken));
                } catch (RuntimeException ex) {
                    log.warn("VibeGuard PR 토큰 복호화 실패 repository={}", repository.getFullName());
                }
            });
        }

        // 외부 GitHub 요청은 서로 독립적이므로 병렬 조회해 첫 대시보드 로딩을 단축한다.
        pullRequestUrls.addAll(repositoryAccesses.parallelStream()
            .flatMap(access -> fetchGithubUrls(access).stream())
            .collect(Collectors.toSet()));
        return pullRequestUrls.size() + persistedWithoutUrl;
    }

    private List<String> fetchGithubUrls(RepositoryAccess access) {
        try {
            List<String> urls = gitHubClient.listVibeGuardPullRequestUrls(
                access.accessToken(), access.fullName());
            return urls == null ? List.of() : urls;
        } catch (RuntimeException ex) {
            // GitHub 일시 장애나 토큰 만료 시에도 DB에 저장된 집계값은 유지한다.
            log.warn("VibeGuard PR GitHub 집계 실패 repository={}", access.fullName());
            return List.of();
        }
    }

    private record RepositoryAccess(String fullName, String accessToken) {
    }
}
