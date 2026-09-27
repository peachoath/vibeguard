package dev.vibeguard.api.finding;

import jakarta.validation.constraints.NotBlank;

/** 오탐 처리 요청 (PRD §9 PATCH /findings/{id}/ignore). */
public record IgnoreRequest(
    @NotBlank String reason
) {
}
