package dev.vibeguard.api.repository;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** 리포 연결 요청 (PRD §9 POST /repositories). */
public record ConnectRepositoryRequest(
    @NotNull Long githubRepoId,
    @NotBlank String fullName,
    @NotBlank String defaultBranch,
    String language
) {
}
