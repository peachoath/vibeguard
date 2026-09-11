package dev.vibeguard.api.repository;

/**
 * GitHub API에서 조회한 리포 요약 (GET /repositories에서 연결 후보로 노출).
 * 아직 우리 DB에 연결되지 않았을 수 있으므로 우리 id는 없다.
 */
public record GitHubRepoDto(
    Long githubRepoId,
    String fullName,
    String defaultBranch,
    String language,
    boolean isPrivate
) {
}
