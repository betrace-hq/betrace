# Agent JAR Signing - CI/CD Integration Guide

**PRD-006 Unit 2:** Cryptographic signing of FLUO security agent JAR in production CI/CD pipelines.

## Overview

The FLUO security agent JAR must be cryptographically signed to prevent tampering and ensure supply chain integrity. This guide covers CI/CD integration for automated signing and verification.

## Prerequisites

1. **Production Keystore**: Generate a production RSA 4096-bit keystore (DO NOT use development keystore)
2. **Secret Management**: Store keystore and password in CI/CD secret manager
3. **Build Environment**: Maven 3.8+, Java 21+

## GitHub Actions Integration

### 1. Store Secrets

Navigate to **Settings → Secrets and variables → Actions** and add:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `AGENT_KEYSTORE_BASE64` | Base64-encoded keystore file | `cat keystore.jks \| base64` |
| `AGENT_KEYSTORE_PASSWORD` | Keystore password | `<strong-random-password>` |

### 2. Workflow Configuration

Create `.github/workflows/build-and-sign.yml`:

```yaml
name: Build and Sign Agent JAR

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-sign-verify:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Java 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'

      - name: Cache Maven dependencies
        uses: actions/cache@v4
        with:
          path: ~/.m2/repository
          key: ${{ runner.os }}-maven-${{ hashFiles('**/pom.xml') }}
          restore-keys: |
            ${{ runner.os }}-maven-

      - name: Restore production keystore
        run: |
          echo "${{ secrets.AGENT_KEYSTORE_BASE64 }}" | base64 -d > backend/security/keystore.jks
          chmod 600 backend/security/keystore.jks

      - name: Build and sign agent JAR
        working-directory: backend
        env:
          AGENT_KEYSTORE_PASSWORD: ${{ secrets.AGENT_KEYSTORE_PASSWORD }}
        run: |
          mvn clean package \
            -Dagent.keystore.password=$AGENT_KEYSTORE_PASSWORD \
            -DskipTests=false

      - name: Verify agent signature
        run: |
          chmod +x backend/scripts/verify-agent-signature.sh
          backend/scripts/verify-agent-signature.sh backend/target/*-agent.jar

      - name: Upload signed agent JAR
        uses: actions/upload-artifact@v4
        with:
          name: fluo-agent-signed
          path: backend/target/*-agent.jar
          retention-days: 30

      - name: Security scan (Trivy)
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: 'backend/target'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'
```

## GitLab CI Integration

Add to `.gitlab-ci.yml`:

```yaml
build-sign-agent:
  stage: build
  image: maven:3.9-eclipse-temurin-21

  before_script:
    - echo "$AGENT_KEYSTORE_BASE64" | base64 -d > backend/security/keystore.jks
    - chmod 600 backend/security/keystore.jks

  script:
    - cd backend
    - mvn clean package -Dagent.keystore.password=$AGENT_KEYSTORE_PASSWORD
    - cd ..
    - chmod +x backend/scripts/verify-agent-signature.sh
    - backend/scripts/verify-agent-signature.sh backend/target/*-agent.jar

  artifacts:
    paths:
      - backend/target/*-agent.jar
    expire_in: 30 days

  variables:
    AGENT_KEYSTORE_PASSWORD:
      value: $AGENT_KEYSTORE_PASSWORD
      description: "Agent keystore password"
```

## Jenkins Integration

Add to `Jenkinsfile`:

```groovy
pipeline {
    agent any

    environment {
        AGENT_KEYSTORE_PASSWORD = credentials('agent-keystore-password')
    }

    stages {
        stage('Restore Keystore') {
            steps {
                script {
                    def keystoreBase64 = credentials('agent-keystore-base64')
                    sh """
                        echo \$keystoreBase64 | base64 -d > backend/security/keystore.jks
                        chmod 600 backend/security/keystore.jks
                    """
                }
            }
        }

        stage('Build and Sign') {
            steps {
                dir('backend') {
                    sh """
                        mvn clean package \
                          -Dagent.keystore.password=\$AGENT_KEYSTORE_PASSWORD \
                          -DskipTests=false
                    """
                }
            }
        }

        stage('Verify Signature') {
            steps {
                sh """
                    chmod +x backend/scripts/verify-agent-signature.sh
                    backend/scripts/verify-agent-signature.sh backend/target/*-agent.jar
                """
            }
        }

        stage('Archive Artifacts') {
            steps {
                archiveArtifacts artifacts: 'backend/target/*-agent.jar', fingerprint: true
            }
        }
    }
}
```

## CircleCI Integration

Add to `.circleci/config.yml`:

```yaml
version: 2.1

executors:
  java-executor:
    docker:
      - image: cimg/openjdk:21.0

jobs:
  build-and-sign:
    executor: java-executor
    steps:
      - checkout

      - restore_cache:
          keys:
            - maven-deps-{{ checksum "backend/pom.xml" }}

      - run:
          name: Restore production keystore
          command: |
            echo $AGENT_KEYSTORE_BASE64 | base64 -d > backend/security/keystore.jks
            chmod 600 backend/security/keystore.jks

      - run:
          name: Build and sign agent JAR
          command: |
            cd backend
            mvn clean package -Dagent.keystore.password=$AGENT_KEYSTORE_PASSWORD

      - run:
          name: Verify signature
          command: |
            chmod +x backend/scripts/verify-agent-signature.sh
            backend/scripts/verify-agent-signature.sh backend/target/*-agent.jar

      - save_cache:
          key: maven-deps-{{ checksum "backend/pom.xml" }}
          paths:
            - ~/.m2/repository

      - store_artifacts:
          path: backend/target/*-agent.jar

workflows:
  build-sign-deploy:
    jobs:
      - build-and-sign:
          context: production-signing
```

## HashiCorp Vault Integration

For organizations using Vault for secret management:

### 1. Store Secrets in Vault

```bash
# Write keystore password
vault kv put secret/fluo/agent-signing \
  keystore-password="<strong-random-password>"

# Write base64-encoded keystore
vault kv put secret/fluo/agent-keystore \
  keystore-base64="$(cat keystore.jks | base64)"
```

### 2. GitHub Actions with Vault

```yaml
      - name: Import secrets from Vault
        uses: hashicorp/vault-action@v2
        with:
          url: https://vault.example.com
          method: jwt
          role: github-actions
          secrets: |
            secret/data/fluo/agent-signing keystore-password | AGENT_KEYSTORE_PASSWORD ;
            secret/data/fluo/agent-keystore keystore-base64 | AGENT_KEYSTORE_BASE64
```

## AWS Secrets Manager Integration

For AWS-hosted CI/CD:

```yaml
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActions
          aws-region: us-east-1

      - name: Retrieve keystore from Secrets Manager
        run: |
          aws secretsmanager get-secret-value \
            --secret-id fluo/agent-keystore-base64 \
            --query SecretString \
            --output text | base64 -d > backend/security/keystore.jks

          export AGENT_KEYSTORE_PASSWORD=$(aws secretsmanager get-secret-value \
            --secret-id fluo/agent-keystore-password \
            --query SecretString \
            --output text)
```

## Security Best Practices

### ✅ DO

- **Rotate keystores annually** - Generate new keys every 12 months
- **Use strong passwords** - Minimum 32 characters, randomly generated
- **Restrict secret access** - Limit to CI/CD service accounts only
- **Verify after signing** - Always run verification script in CI/CD
- **Audit access logs** - Monitor who accesses signing secrets

### ❌ DO NOT

- **Commit keystores to Git** - Never check in `keystore.jks` files
- **Use development keys in production** - Separate dev and prod keystores
- **Share passwords in Slack/email** - Use secret management only
- **Skip verification** - Always verify signature post-build
- **Reuse keys across environments** - Unique keys per environment

## Troubleshooting

### Error: "jarsigner: unable to sign jar"

**Cause:** Keystore password incorrect or file corrupted

**Solution:**
```bash
# Verify keystore is readable
keytool -list -v -keystore backend/security/keystore.jks -storepass $PASSWORD
```

### Error: "jar verified" not found in output

**Cause:** Agent JAR not properly signed

**Solution:**
```bash
# Check if signature exists
unzip -l target/*-agent.jar | grep -E "(\.SF|\.RSA|\.DSA)"
```

### Error: "Certificate chain not found"

**Cause:** Keystore missing or alias incorrect

**Solution:**
```bash
# List keystore aliases
keytool -list -keystore backend/security/keystore.jks -storepass changeit
```

## Compliance Impact

### SOC2 CC8.1 (Change Management)
- **Evidence:** Signed JARs in artifact repository
- **Control:** Prevents unauthorized modification of security agent
- **Audit:** Signature verification logs in CI/CD

### HIPAA 164.312(c)(1) (Integrity)
- **Evidence:** Cryptographic signatures on all production JARs
- **Control:** Detects tampering of PHI-handling components
- **Audit:** Signature verification required before deployment

## References

- **PRD-006:** Sandbox Monitoring and Hardening (Unit 2)
- **Maven Jarsigner Plugin:** https://maven.apache.org/plugins/maven-jarsigner-plugin/
- **Java Code Signing:** https://docs.oracle.com/javase/tutorial/security/toolsign/
- **NIST SP 800-204B:** Attribute-based Access Control for Microservices
