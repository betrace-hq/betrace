package com.fluo.compliance.evidence;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for ComplianceSpanSigner cryptographic signature generation.
 */
class ComplianceSpanSignerTest {

    @Test
    @DisplayName("Same span with same key produces same signature")
    void testDeterministicSignature() {
        TestComplianceSpan span = createTestSpan();
        byte[] signingKey = "test-signing-key-32-bytes-long!!".getBytes(StandardCharsets.UTF_8);

        String signature1 = ComplianceSpanSigner.sign(span, signingKey);
        String signature2 = ComplianceSpanSigner.sign(span, signingKey);

        assertEquals(signature1, signature2, "Same span should produce same signature");
    }

    @Test
    @DisplayName("Different spans produce different signatures")
    void testUniqueSignatures() {
        byte[] signingKey = "test-signing-key-32-bytes-long!!".getBytes(StandardCharsets.UTF_8);

        TestComplianceSpan span1 = createTestSpan();
        TestComplianceSpan span2 = new TestComplianceSpan.Builder()
            .timestamp(Instant.now())
            .traceId("trace-456")
            .spanId("span-456")
            .framework("soc2")
            .control("CC6_2")
            .evidenceType("audit_trail")
            .result("failure")
            .build();

        String signature1 = ComplianceSpanSigner.sign(span1, signingKey);
        String signature2 = ComplianceSpanSigner.sign(span2, signingKey);

        assertNotEquals(signature1, signature2, "Different spans should produce different signatures");
    }

    @Test
    @DisplayName("Different keys produce different signatures")
    void testKeyIsolation() {
        TestComplianceSpan span = createTestSpan();

        byte[] key1 = "tenant-1-key-32-bytes-long!!!!!".getBytes(StandardCharsets.UTF_8);
        byte[] key2 = "tenant-2-key-32-bytes-long!!!!!".getBytes(StandardCharsets.UTF_8);

        String signature1 = ComplianceSpanSigner.sign(span, key1);
        String signature2 = ComplianceSpanSigner.sign(span, key2);

        assertNotEquals(signature1, signature2, "Different keys should produce different signatures");
    }

    @Test
    @DisplayName("Null signing key throws exception")
    void testNullKeyThrows() {
        TestComplianceSpan span = createTestSpan();

        assertThrows(IllegalArgumentException.class, () -> {
            ComplianceSpanSigner.sign(span, null);
        }, "Null signing key should throw exception");
    }

    @Test
    @DisplayName("Empty signing key throws exception")
    void testEmptyKeyThrows() {
        TestComplianceSpan span = createTestSpan();

        assertThrows(IllegalArgumentException.class, () -> {
            ComplianceSpanSigner.sign(span, new byte[0]);
        }, "Empty signing key should throw exception");
    }

    @Test
    @DisplayName("Signature changes when attributes change")
    void testAttributeSensitivity() {
        byte[] signingKey = "test-signing-key-32-bytes-long!!".getBytes(StandardCharsets.UTF_8);

        TestComplianceSpan span1 = new TestComplianceSpan.Builder()
            .timestamp(Instant.ofEpochMilli(1000000))
            .traceId("trace-123")
            .spanId("span-123")
            .framework("soc2")
            .control("CC6_1")
            .evidenceType("audit_trail")
            .attribute("count", 5)
            .build();

        TestComplianceSpan span2 = new TestComplianceSpan.Builder()
            .timestamp(Instant.ofEpochMilli(1000000))
            .traceId("trace-123")
            .spanId("span-123")
            .framework("soc2")
            .control("CC6_1")
            .evidenceType("audit_trail")
            .attribute("count", 10)  // Different count
            .build();

        String signature1 = ComplianceSpanSigner.sign(span1, signingKey);
        String signature2 = ComplianceSpanSigner.sign(span2, signingKey);

        assertNotEquals(signature1, signature2, "Changing attributes should change signature");
    }

    @Test
    @DisplayName("Signature is Base64 encoded")
    void testBase64Encoding() {
        TestComplianceSpan span = createTestSpan();
        byte[] signingKey = "test-signing-key-32-bytes-long!!".getBytes(StandardCharsets.UTF_8);

        String signature = ComplianceSpanSigner.sign(span, signingKey);

        assertNotNull(signature);
        assertTrue(signature.matches("^[A-Za-z0-9+/]+=*$"), "Signature should be valid Base64");
    }

    @Test
    @DisplayName("Signature verification detects tampering")
    void testTamperDetection() {
        byte[] signingKey = "test-signing-key-32-bytes-long!!".getBytes(StandardCharsets.UTF_8);

        TestComplianceSpan span = new TestComplianceSpan.Builder()
            .timestamp(Instant.ofEpochMilli(1000000))
            .traceId("trace-123")
            .spanId("span-123")
            .framework("soc2")
            .control("CC6_1")
            .evidenceType("audit_trail")
            .build();

        String validSignature = ComplianceSpanSigner.sign(span, signingKey);

        // Create span with valid signature
        TestComplianceSpan signedSpan = new TestComplianceSpan.Builder()
            .timestamp(Instant.ofEpochMilli(1000000))
            .traceId("trace-123")
            .spanId("span-123")
            .framework("soc2")
            .control("CC6_1")
            .evidenceType("audit_trail")
            .signature(validSignature)
            .build();

        // Verification should pass
        assertTrue(signedSpan.verifySignature(signingKey), "Valid signature should verify");

        // Tamper with span by changing control
        TestComplianceSpan tamperedSpan = new TestComplianceSpan.Builder()
            .timestamp(Instant.ofEpochMilli(1000000))
            .traceId("trace-123")
            .spanId("span-123")
            .framework("soc2")
            .control("CC6_2")  // Different control!
            .evidenceType("audit_trail")
            .signature(validSignature)  // Old signature
            .build();

        // Verification should fail
        assertFalse(tamperedSpan.verifySignature(signingKey), "Tampered span should fail verification");
    }

    // Helper methods

    private TestComplianceSpan createTestSpan() {
        return new TestComplianceSpan.Builder()
            .timestamp(Instant.ofEpochMilli(1000000))
            .traceId("trace-123")
            .spanId("span-123")
            .framework("soc2")
            .control("CC6_1")
            .evidenceType("audit_trail")
            .result("success")
            .duration(Duration.ofMillis(100))
            .attribute("operation", "authorization_check")  // Safe attribute
            .build();
    }

    /**
     * Test implementation of ComplianceSpan for unit testing.
     */
    private static class TestComplianceSpan extends ComplianceSpan {

        private TestComplianceSpan(Builder builder) {
            super(builder);
        }

        @Override
        public void exportToOtel() {
            // No-op for testing
        }

        private static class Builder extends ComplianceSpan.Builder<Builder> {
            @Override
            protected Builder self() {
                return this;
            }

            @Override
            public TestComplianceSpan build() {
                return new TestComplianceSpan(this);
            }
        }
    }
}
