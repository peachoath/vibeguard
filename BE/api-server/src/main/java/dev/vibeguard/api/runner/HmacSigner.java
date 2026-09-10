package dev.vibeguard.api.runner;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Runner ↔ API 콜백 무결성용 HMAC-SHA256 서명/검증 (NFR-S4).
 * 서명 대상은 본문 raw bytes. 헤더 포맷: {@code X-VibeGuard-Signature: sha256=<hex>}.
 * 시크릿은 api-server/.env 와 agent/.env 의 RUNNER_CALLBACK_SECRET 이 동일해야 한다.
 */
@Component
public class HmacSigner {

    private static final String ALGO = "HmacSHA256";
    private static final String PREFIX = "sha256=";

    private final byte[] secret;

    public HmacSigner(@Value("${vibeguard.runner.callback-secret}") String secret) {
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
    }

    /** 본문 raw bytes에 대한 서명 문자열(sha256=hex)을 생성. */
    public String sign(byte[] body) {
        return PREFIX + hex(hmac(body));
    }

    /**
     * 수신 서명 검증. 상수 시간 비교로 타이밍 공격 방지.
     * @param signatureHeader X-VibeGuard-Signature 값 (sha256=... 형식)
     */
    public boolean verify(byte[] body, String signatureHeader) {
        if (signatureHeader == null || !signatureHeader.startsWith(PREFIX)) {
            return false;
        }
        byte[] expected = hmac(body);
        byte[] provided;
        try {
            provided = HexFormat.of().parseHex(signatureHeader.substring(PREFIX.length()));
        } catch (IllegalArgumentException ex) {
            return false;
        }
        return MessageDigest.isEqual(expected, provided);
    }

    private byte[] hmac(byte[] body) {
        try {
            Mac mac = Mac.getInstance(ALGO);
            mac.init(new SecretKeySpec(secret, ALGO));
            return mac.doFinal(body);
        } catch (Exception ex) {
            throw new IllegalStateException("HMAC 계산 실패", ex);
        }
    }

    private String hex(byte[] bytes) {
        return HexFormat.of().formatHex(bytes);
    }
}
