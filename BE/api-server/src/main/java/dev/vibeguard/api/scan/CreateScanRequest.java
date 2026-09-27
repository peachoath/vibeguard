package dev.vibeguard.api.scan;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/** 스캔 시작 요청 (PRD §9 POST /scans). */
public record CreateScanRequest(
    @NotNull UUID repositoryId,
    @NotBlank String ref
) {
}
