package dev.vibeguard.api.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * repositories 테이블 접근 (Spring Data JPA).
 *
 * <p>엔티티명이 {@code Repository}라 Spring Data의 마커 인터페이스와 이름이 겹치므로,
 * JPA 리포지토리 인터페이스는 복수형 {@code Repositories}로 명명한다.
 */
public interface Repositories extends JpaRepository<Repository, UUID> {

    List<Repository> findByUserId(UUID userId);

    Optional<Repository> findByUserIdAndGithubRepoId(UUID userId, Long githubRepoId);
}
