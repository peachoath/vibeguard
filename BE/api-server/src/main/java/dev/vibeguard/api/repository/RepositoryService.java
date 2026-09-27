package dev.vibeguard.api.repository;

import dev.vibeguard.api.security.TokenCipher;
import dev.vibeguard.api.user.User;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 리포지토리 연결/조회 도메인 서비스 (F-02). */
@Service
public class RepositoryService {

    private final Repositories repositories;
    private final GitHubClient gitHubClient;
    private final TokenCipher tokenCipher;

    public RepositoryService(Repositories repositories, GitHubClient gitHubClient, TokenCipher tokenCipher) {
        this.repositories = repositories;
        this.gitHubClient = gitHubClient;
        this.tokenCipher = tokenCipher;
    }

    /** GitHub에서 접근 가능한 리포 목록 조회 (연결 후보). 저장된 암호화 토큰을 복호화해 사용. */
    public List<GitHubRepoDto> listGitHubRepositories(User user) {
        String token = tokenCipher.decrypt(user.getAccessToken());
        return gitHubClient.listRepositories(token);
    }

    /** 우리 DB에 연결된 리포 목록. */
    public List<RepositoryDto> listConnected(User user) {
        return repositories.findByUserId(user.getId()).stream()
            .map(RepositoryDto::from)
            .toList();
    }

    /** 리포 연결(upsert). 동일 (user, githubRepoId)면 정보만 갱신. */
    @Transactional
    public RepositoryDto connect(User user, ConnectRepositoryRequest req) {
        Repository repo = repositories.findByUserIdAndGithubRepoId(user.getId(), req.githubRepoId())
            .map(existing -> {
                existing.setFullName(req.fullName());
                existing.setDefaultBranch(req.defaultBranch());
                existing.setLanguage(req.language());
                return existing;
            })
            .orElseGet(() -> repositories.save(
                new Repository(user.getId(), req.githubRepoId(), req.fullName(), req.defaultBranch(), req.language())));
        return RepositoryDto.from(repo);
    }
}
