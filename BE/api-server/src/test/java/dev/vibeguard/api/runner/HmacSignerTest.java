package dev.vibeguard.api.runner;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

/** HmacSigner 서명/검증 단위 테스트 (DB·Docker 불필요). */
class HmacSignerTest {

    private final HmacSigner signer = new HmacSigner("test-secret");

    @Test
    void 서명한_본문은_동일_시크릿으로_검증에_성공한다() {
        byte[] body = "{\"scanId\":\"abc\",\"kind\":\"stage\"}".getBytes(StandardCharsets.UTF_8);

        String signature = signer.sign(body);

        assertThat(signature).startsWith("sha256=");
        assertThat(signer.verify(body, signature)).isTrue();
    }

    @Test
    void 본문이_변조되면_검증에_실패한다() {
        byte[] body = "original".getBytes(StandardCharsets.UTF_8);
        String signature = signer.sign(body);

        byte[] tampered = "tampered".getBytes(StandardCharsets.UTF_8);

        assertThat(signer.verify(tampered, signature)).isFalse();
    }

    @Test
    void 다른_시크릿으로_만든_서명은_검증에_실패한다() {
        byte[] body = "payload".getBytes(StandardCharsets.UTF_8);
        String otherSignature = new HmacSigner("other-secret").sign(body);

        assertThat(signer.verify(body, otherSignature)).isFalse();
    }

    @Test
    void 형식이_잘못된_서명헤더는_검증에_실패한다() {
        byte[] body = "payload".getBytes(StandardCharsets.UTF_8);

        assertThat(signer.verify(body, null)).isFalse();
        assertThat(signer.verify(body, "")).isFalse();
        assertThat(signer.verify(body, "md5=abcd")).isFalse();
        assertThat(signer.verify(body, "sha256=notahexstring!!")).isFalse();
    }
}
