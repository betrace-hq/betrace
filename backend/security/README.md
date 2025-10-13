# FLUO Security Agent JAR Signing

**Purpose:** Cryptographic signing of the Java Instrumentation Agent JAR to prevent tampering.

## Development Keystore

**Location:** `backend/security/keystore.jks` (gitignored)

**Credentials (Development Only):**
- Alias: `fluo-agent`
- Store Password: `changeit`
- Key Password: `changeit`

**Key Details:**
- Algorithm: RSA 4096-bit
- Validity: 10 years
- Distinguished Name: `CN=FLUO Security Agent, OU=Security, O=FLUO, L=San Francisco, ST=California, C=US`
- Key Usage: `digitalSignature`, `codeSigning`

## Generating Keystore (if missing)

```bash
nix develop --command keytool -genkeypair \
  -alias fluo-agent \
  -keyalg RSA \
  -keysize 4096 \
  -validity 3650 \
  -keystore backend/security/keystore.jks \
  -storepass changeit \
  -keypass changeit \
  -dname "CN=FLUO Security Agent, OU=Security, O=FLUO, L=San Francisco, ST=California, C=US" \
  -ext KeyUsage=digitalSignature \
  -ext ExtendedKeyUsage=codeSigning
```

## Verifying Keystore

```bash
nix develop --command keytool -list -v -keystore backend/security/keystore.jks -storepass changeit
```

## Production Deployment

**⚠️ NEVER use development keystore in production!**

Production keystores must:
1. Use strong, randomly-generated passwords
2. Be stored in CI/CD secret management (GitHub Actions secrets, HashiCorp Vault, AWS Secrets Manager)
3. Have restricted access (only CI/CD runners)
4. Be rotated annually

**GitHub Actions Example:**
```yaml
- name: Sign Agent JAR
  env:
    KEYSTORE_PASSWORD: ${{ secrets.AGENT_KEYSTORE_PASSWORD }}
  run: |
    echo "${{ secrets.AGENT_KEYSTORE_BASE64 }}" | base64 -d > /tmp/keystore.jks
    mvn jarsigner:sign -Dagent.keystore.password=$KEYSTORE_PASSWORD
```

## Signature Verification

After building, verify the agent JAR is signed:

```bash
nix develop --command jarsigner -verify -verbose target/*-agent.jar
```

Expected output:
```
jar verified.
```

## Security Properties

**Integrity Protection:**
- JAR contents cannot be modified without invalidating signature
- JVM can reject unsigned/invalid JARs with security policy
- Supply chain attacks via JAR tampering are detectable

**Compliance:**
- **SOC2 CC8.1** (Change Management): Ensures agent integrity
- **HIPAA 164.312(c)(1)** (Integrity): Protects against unauthorized modification

## References

- **PRD-006:** Sandbox Monitoring and Hardening (Unit 2: Agent JAR Signing)
- **Maven Jarsigner Plugin:** https://maven.apache.org/plugins/maven-jarsigner-plugin/
- **Java Code Signing:** https://docs.oracle.com/javase/tutorial/security/toolsign/
