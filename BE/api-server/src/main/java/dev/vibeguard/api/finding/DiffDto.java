package dev.vibeguard.api.finding;

import java.util.UUID;

/** 패치 diff 응답 (PRD §9 DiffDto, F-08). */
public record DiffDto(
    UUID findingId,
    String format,
    String filePath,
    String patch
) {
}
