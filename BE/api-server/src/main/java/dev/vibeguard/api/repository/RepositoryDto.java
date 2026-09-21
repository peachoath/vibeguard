package dev.vibeguard.api.repository;

import java.time.OffsetDateTime;
import java.util.UUID;

/** 연결된 리포지토리 응답 (PRD §9 /repositories). */
public record RepositoryDto(
    UUID id,
    Long githubRepoId,
    String fullName,
    String defaultBranch,
    String language,
    OffsetDateTime connectedAt
) {
    public static RepositoryDto from(Repository repo) {
        return new RepositoryDto(
            repo.getId(),
            repo.getGithubRepoId(),
            repo.getFullName(),
            repo.getDefaultBranch(),
            repo.getLanguage(),
            repo.getConnectedAt());
    }
}
