package dev.vibeguard.api.finding;

/** Finding 처리 상태. DB 기본값은 OPEN (V1__init.sql). */
public enum FindingStatus {
    OPEN,
    IGNORED,
    PATCHED,
    MANUAL
}
