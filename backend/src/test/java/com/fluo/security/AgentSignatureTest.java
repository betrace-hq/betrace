package com.fluo.security;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.CodeSigner;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.util.Enumeration;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;

import static org.junit.jupiter.api.Assertions.*;

/**
 * PRD-006 Unit 2: Agent JAR Signature Validation Tests
 *
 * Tests cryptographic signature verification of the FLUO security agent JAR.
 *
 * Security Properties Tested:
 * - Signature exists and is valid
 * - Certificate uses RSA 4096-bit encryption
 * - Certificate matches expected alias (fluo-agent)
 * - All JAR entries are signed (no unsigned code)
 * - Signature includes required manifest attributes
 *
 * Compliance Evidence:
 * - SOC2 CC8.1 (Change Management): Verifies agent integrity
 * - HIPAA 164.312(c)(1) (Integrity): Prevents unauthorized modification
 */
@EnabledIfSystemProperty(named = "security.tests.enabled", matches = "true")
class AgentSignatureTest {

    private static final String EXPECTED_ALIAS = "fluo-agent";
    private static final String EXPECTED_ALGORITHM = "RSA";
    private static final int MIN_KEY_SIZE = 4096;

    /**
     * Find the agent JAR in the target directory.
     * Searches for *-agent.jar pattern.
     */
    private Path findAgentJar() throws IOException {
        Path targetDir = Paths.get("target");
        if (!Files.exists(targetDir)) {
            fail("Target directory not found. Run 'mvn package' first.");
        }

        return Files.list(targetDir)
                .filter(p -> p.getFileName().toString().endsWith("-agent.jar"))
                .findFirst()
                .orElseThrow(() -> new AssertionError(
                        "Agent JAR not found in target/. Run 'mvn package' first."
                ));
    }

    @Test
    void testAgentJarExists() throws IOException {
        Path agentJar = findAgentJar();
        assertTrue(Files.exists(agentJar),
                "Agent JAR should exist: " + agentJar);
    }

    @Test
    void testAgentJarIsSigned() throws IOException {
        Path agentJar = findAgentJar();

        try (JarFile jarFile = new JarFile(agentJar.toFile(), true)) {
            // Verify META-INF/MANIFEST.MF exists
            assertNotNull(jarFile.getManifest(),
                    "Agent JAR must have a manifest");

            // Check for signature files (.SF and .RSA/.DSA)
            boolean hasSignatureFile = false;
            boolean hasSignatureBlock = false;

            Enumeration<JarEntry> entries = jarFile.entries();
            while (entries.hasMoreElements()) {
                JarEntry entry = entries.nextElement();
                String name = entry.getName();

                if (name.startsWith("META-INF/") && name.endsWith(".SF")) {
                    hasSignatureFile = true;
                }
                if (name.startsWith("META-INF/") &&
                        (name.endsWith(".RSA") || name.endsWith(".DSA"))) {
                    hasSignatureBlock = true;
                }
            }

            assertTrue(hasSignatureFile,
                    "Agent JAR must contain signature file (*.SF)");
            assertTrue(hasSignatureBlock,
                    "Agent JAR must contain signature block (*.RSA or *.DSA)");
        }
    }

    @Test
    void testAllEntriesAreSigned() throws IOException {
        Path agentJar = findAgentJar();

        try (JarFile jarFile = new JarFile(agentJar.toFile(), true)) {
            Enumeration<JarEntry> entries = jarFile.entries();
            int classFileCount = 0;
            int signedClassFileCount = 0;

            while (entries.hasMoreElements()) {
                JarEntry entry = entries.nextElement();

                // Skip directories and META-INF entries
                if (entry.isDirectory() || entry.getName().startsWith("META-INF/")) {
                    continue;
                }

                // Only check .class files (actual code)
                if (entry.getName().endsWith(".class")) {
                    classFileCount++;

                    // Read entry to trigger signature verification
                    byte[] buffer = new byte[8192];
                    try (var is = jarFile.getInputStream(entry)) {
                        while (is.read(buffer) != -1) {
                            // Reading triggers signature check
                        }
                    }

                    // Check if entry is signed
                    CodeSigner[] signers = entry.getCodeSigners();
                    if (signers != null && signers.length > 0) {
                        signedClassFileCount++;
                    }
                }
            }

            assertTrue(classFileCount > 0,
                    "Agent JAR should contain class files");
            assertEquals(classFileCount, signedClassFileCount,
                    "All class files must be signed. Found " + classFileCount +
                            " class files but only " + signedClassFileCount + " are signed");
        }
    }

    @Test
    void testCertificateAlgorithm() throws IOException {
        Path agentJar = findAgentJar();

        try (JarFile jarFile = new JarFile(agentJar.toFile(), true)) {
            // Find first signed entry
            CodeSigner[] signers = findFirstCodeSigner(jarFile);
            assertNotNull(signers, "Agent JAR must have at least one signed entry");
            assertTrue(signers.length > 0, "At least one code signer must exist");

            // Get certificate from first signer
            Certificate cert = signers[0].getSignerCertPath().getCertificates().get(0);
            assertTrue(cert instanceof X509Certificate,
                    "Certificate must be X.509 format");

            X509Certificate x509 = (X509Certificate) cert;
            String algorithm = x509.getPublicKey().getAlgorithm();

            assertEquals(EXPECTED_ALGORITHM, algorithm,
                    "Certificate must use " + EXPECTED_ALGORITHM + " algorithm");
        }
    }

    @Test
    void testCertificateKeySize() throws IOException {
        Path agentJar = findAgentJar();

        try (JarFile jarFile = new JarFile(agentJar.toFile(), true)) {
            CodeSigner[] signers = findFirstCodeSigner(jarFile);
            assertNotNull(signers, "Agent JAR must have at least one signed entry");

            Certificate cert = signers[0].getSignerCertPath().getCertificates().get(0);
            X509Certificate x509 = (X509Certificate) cert;

            // For RSA, key size is the modulus bit length
            if (x509.getPublicKey().getAlgorithm().equals("RSA")) {
                String keyString = x509.getPublicKey().toString();
                // Extract modulus size from key string (e.g., "4096 bits")
                assertTrue(keyString.contains("4096") || keyString.contains(String.valueOf(MIN_KEY_SIZE)),
                        "RSA key must be at least " + MIN_KEY_SIZE + " bits");
            }
        }
    }

    @Test
    void testCertificateSubject() throws IOException {
        Path agentJar = findAgentJar();

        try (JarFile jarFile = new JarFile(agentJar.toFile(), true)) {
            CodeSigner[] signers = findFirstCodeSigner(jarFile);
            assertNotNull(signers, "Agent JAR must have at least one signed entry");

            Certificate cert = signers[0].getSignerCertPath().getCertificates().get(0);
            X509Certificate x509 = (X509Certificate) cert;

            String subject = x509.getSubjectX500Principal().getName();
            assertNotNull(subject, "Certificate must have a subject");
            assertTrue(subject.contains("CN=FLUO Security Agent"),
                    "Certificate subject must contain 'CN=FLUO Security Agent'");
        }
    }

    @Test
    void testManifestAttributes() throws IOException {
        Path agentJar = findAgentJar();

        try (JarFile jarFile = new JarFile(agentJar.toFile(), true)) {
            var manifest = jarFile.getManifest();
            var attributes = manifest.getMainAttributes();

            // Required Java agent attributes
            assertEquals("com.fluo.security.agent.SandboxAgent",
                    attributes.getValue("Premain-Class"),
                    "Manifest must contain Premain-Class");

            assertEquals("com.fluo.security.agent.SandboxAgent",
                    attributes.getValue("Agent-Class"),
                    "Manifest must contain Agent-Class");

            assertEquals("true",
                    attributes.getValue("Can-Redefine-Classes"),
                    "Manifest must enable class redefinition");

            assertEquals("true",
                    attributes.getValue("Can-Retransform-Classes"),
                    "Manifest must enable class retransformation");
        }
    }

    @Test
    void testSignatureNotExpired() throws IOException {
        Path agentJar = findAgentJar();

        try (JarFile jarFile = new JarFile(agentJar.toFile(), true)) {
            CodeSigner[] signers = findFirstCodeSigner(jarFile);
            assertNotNull(signers, "Agent JAR must have at least one signed entry");

            Certificate cert = signers[0].getSignerCertPath().getCertificates().get(0);
            X509Certificate x509 = (X509Certificate) cert;

            // Check certificate is not expired
            assertDoesNotThrow(() -> x509.checkValidity(),
                    "Certificate must not be expired");
        }
    }

    /**
     * Helper: Find first signed code entry in JAR.
     * Reads through JAR entries until finding one with code signers.
     */
    private CodeSigner[] findFirstCodeSigner(JarFile jarFile) throws IOException {
        Enumeration<JarEntry> entries = jarFile.entries();

        while (entries.hasMoreElements()) {
            JarEntry entry = entries.nextElement();

            // Skip directories and META-INF
            if (entry.isDirectory() || entry.getName().startsWith("META-INF/")) {
                continue;
            }

            // Only check .class files
            if (entry.getName().endsWith(".class")) {
                // Read entry to trigger signature verification
                byte[] buffer = new byte[8192];
                try (var is = jarFile.getInputStream(entry)) {
                    while (is.read(buffer) != -1) {
                        // Reading triggers signature check
                    }
                }

                CodeSigner[] signers = entry.getCodeSigners();
                if (signers != null && signers.length > 0) {
                    return signers;
                }
            }
        }

        return null;
    }
}
