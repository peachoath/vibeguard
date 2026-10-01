package dev.vibeguard.api.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.vibeguard.api.pr.PullRequest;
import dev.vibeguard.api.pr.PullRequestRepository;
import dev.vibeguard.api.repository.GitHubClient;
import dev.vibeguard.api.repository.Repositories;
import dev.vibeguard.api.repository.Repository;
import dev.vibeguard.api.security.TokenCipher;
import dev.vibeguard.api.user.User;
import dev.vibeguard.api.user.UserRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class GeneratedPullRequestCounterTest {

    @Mock PullRequestRepository pullRequestRepository;
    @Mock Repositories repositories;
    @Mock UserRepository userRepository;
    @Mock GitHubClient gitHubClient;
    @Mock TokenCipher tokenCipher;
    @InjectMocks GeneratedPullRequestCounter counter;

    @Test
    void DB와_GitHub_PR을_URL로_중복제거해_집계한다() {
        User user = new User(1L, "octocat", null, "encrypted-token");
        Repository repository = new Repository(
            user.getId(), 10L, "owner/repository", "main", "Java");
        PullRequest persisted = new PullRequest(UUID.randomUUID());
        persisted.setUrl("https://github.com/owner/repository/pull/1");

        when(pullRequestRepository.findAll()).thenReturn(List.of(persisted));
        when(repositories.findAll()).thenReturn(List.of(repository));
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(tokenCipher.decrypt("encrypted-token")).thenReturn("access-token");
        when(gitHubClient.listVibeGuardPullRequestUrls("access-token", "owner/repository"))
            .thenReturn(List.of(
                "https://github.com/owner/repository/pull/1",
                "https://github.com/owner/repository/pull/2",
                "https://github.com/owner/repository/pull/3"));

        assertThat(counter.count()).isEqualTo(3);
        assertThat(counter.count()).isEqualTo(3);
        verify(gitHubClient, times(1))
            .listVibeGuardPullRequestUrls("access-token", "owner/repository");
    }

    @Test
    void GitHub_조회_실패시_DB_집계값을_유지한다() {
        User user = new User(1L, "octocat", null, "encrypted-token");
        Repository repository = new Repository(
            user.getId(), 10L, "owner/repository", "main", "Java");
        PullRequest persisted = new PullRequest(UUID.randomUUID());
        persisted.setUrl("https://github.com/owner/repository/pull/1");

        when(pullRequestRepository.findAll()).thenReturn(List.of(persisted));
        when(repositories.findAll()).thenReturn(List.of(repository));
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(tokenCipher.decrypt("encrypted-token")).thenReturn("access-token");
        when(gitHubClient.listVibeGuardPullRequestUrls("access-token", "owner/repository"))
            .thenThrow(new IllegalStateException("GitHub unavailable"));

        assertThat(counter.count()).isEqualTo(1);
    }
}
