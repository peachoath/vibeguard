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

        when(pullRequestRepository.findAllByUserId(user.getId())).thenReturn(List.of(persisted));
        when(repositories.findByUserId(user.getId())).thenReturn(List.of(repository));
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(tokenCipher.decrypt("encrypted-token")).thenReturn("access-token");
        when(gitHubClient.listVibeGuardPullRequestUrls("access-token", "owner/repository"))
            .thenReturn(List.of(
                "https://github.com/owner/repository/pull/1",
                "https://github.com/owner/repository/pull/2",
                "https://github.com/owner/repository/pull/3"));

        assertThat(counter.count(user.getId())).isEqualTo(3);
        assertThat(counter.count(user.getId())).isEqualTo(3);
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

        when(pullRequestRepository.findAllByUserId(user.getId())).thenReturn(List.of(persisted));
        when(repositories.findByUserId(user.getId())).thenReturn(List.of(repository));
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(tokenCipher.decrypt("encrypted-token")).thenReturn("access-token");
        when(gitHubClient.listVibeGuardPullRequestUrls("access-token", "owner/repository"))
            .thenThrow(new IllegalStateException("GitHub unavailable"));

        assertThat(counter.count(user.getId())).isEqualTo(1);
    }

    @Test
    void 사용자별_캐시와_저장소를_분리한다() {
        User first = new User(1L, "first", null, "first-encrypted");
        User second = new User(2L, "second", null, "second-encrypted");
        Repository firstRepo = new Repository(first.getId(), 10L, "first/repo", "main", "Java");
        Repository secondRepo = new Repository(second.getId(), 20L, "second/repo", "main", "Java");

        when(pullRequestRepository.findAllByUserId(first.getId())).thenReturn(List.of());
        when(pullRequestRepository.findAllByUserId(second.getId())).thenReturn(List.of());
        when(repositories.findByUserId(first.getId())).thenReturn(List.of(firstRepo));
        when(repositories.findByUserId(second.getId())).thenReturn(List.of(secondRepo));
        when(userRepository.findById(first.getId())).thenReturn(Optional.of(first));
        when(userRepository.findById(second.getId())).thenReturn(Optional.of(second));
        when(tokenCipher.decrypt("first-encrypted")).thenReturn("first-token");
        when(tokenCipher.decrypt("second-encrypted")).thenReturn("second-token");
        when(gitHubClient.listVibeGuardPullRequestUrls("first-token", "first/repo"))
            .thenReturn(List.of("https://github.com/first/repo/pull/1"));
        when(gitHubClient.listVibeGuardPullRequestUrls("second-token", "second/repo"))
            .thenReturn(List.of(
                "https://github.com/second/repo/pull/1",
                "https://github.com/second/repo/pull/2"));

        assertThat(counter.count(first.getId())).isEqualTo(1);
        assertThat(counter.count(second.getId())).isEqualTo(2);
    }
}
