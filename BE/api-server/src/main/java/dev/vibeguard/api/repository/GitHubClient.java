package dev.vibeguard.api.repository;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Arrays;
import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * GitHub REST API 클라이언트. 사용자 access token으로 접근 가능한 리포를 조회한다.
 * 토큰은 호출 시점에 복호화된 평문을 받아 Authorization 헤더로만 사용하고 저장/로그하지 않는다 (NFR-S3).
 */
@Component
public class GitHubClient {

    private static final String API_BASE = "https://api.github.com";

    private final RestClient restClient;

    public GitHubClient() {
        this.restClient = RestClient.builder()
            .baseUrl(API_BASE)
            .defaultHeader("Accept", "application/vnd.github+json")
            .defaultHeader("X-GitHub-Api-Version", "2022-11-28")
            .build();
    }

    /** 현재 사용자가 접근 가능한 리포 목록 (최신 갱신순, 최대 100개). */
    public List<GitHubRepoDto> listRepositories(String accessToken) {
        GitHubRepo[] repos = restClient.get()
            .uri("/user/repos?per_page=100&sort=updated")
            .header("Authorization", "Bearer " + accessToken)
            .retrieve()
            .body(GitHubRepo[].class);

        if (repos == null) {
            return List.of();
        }
        return Arrays.stream(repos)
            .map(r -> new GitHubRepoDto(r.id(), r.fullName(), r.defaultBranch(), r.language(), r.isPrivate()))
            .toList();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record GitHubRepo(
        Long id,
        @JsonProperty("full_name") String fullName,
        @JsonProperty("default_branch") String defaultBranch,
        String language,
        @JsonProperty("private") boolean isPrivate
    ) {
    }
}
