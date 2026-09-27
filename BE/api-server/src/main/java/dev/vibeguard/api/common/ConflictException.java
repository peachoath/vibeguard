package dev.vibeguard.api.common;

/** 리소스 충돌 (409) — 예: 동일 repo+ref 스캔이 이미 진행 중. */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
