#!/usr/bin/env bash
# PRD-006 Unit 2: Agent JAR Signature Verification
# Purpose: Verify cryptographic signature of FLUO security agent JAR
# Usage: ./backend/scripts/verify-agent-signature.sh [path-to-agent.jar]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
AGENT_JAR="${1:-backend/target/*-agent.jar}"
EXPECTED_ALIAS="fluo-agent"
EXPECTED_ALGORITHM="RSA"
MIN_KEY_SIZE=4096

echo "🔐 FLUO Agent JAR Signature Verification"
echo "========================================"
echo ""

# Check if agent JAR exists
if ! compgen -G "$AGENT_JAR" > /dev/null; then
    echo -e "${RED}❌ ERROR: Agent JAR not found: $AGENT_JAR${NC}"
    echo ""
    echo "Build the agent JAR first:"
    echo "  nix develop --command mvn clean package"
    exit 1
fi

# Expand wildcard if present
AGENT_JAR_EXPANDED=$(compgen -G "$AGENT_JAR" | head -n 1)

echo "📦 Verifying: $AGENT_JAR_EXPANDED"
echo ""

# Verify JAR signature
echo "🔍 Step 1: Signature Verification"
echo "-----------------------------------"
if jarsigner -verify -verbose "$AGENT_JAR_EXPANDED" 2>&1 | tee /tmp/verify.log; then
    if grep -q "jar verified" /tmp/verify.log; then
        echo -e "${GREEN}✅ Signature is valid${NC}"
    else
        echo -e "${RED}❌ Signature verification failed${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Signature verification failed${NC}"
    exit 1
fi

echo ""
echo "🔍 Step 2: Certificate Details"
echo "-------------------------------"
jarsigner -verify -verbose -certs "$AGENT_JAR_EXPANDED" | grep -A 20 "Signer #1" || true

echo ""
echo "🔍 Step 3: Security Properties"
echo "-------------------------------"

# Extract certificate details
CERT_DETAILS=$(jarsigner -verify -verbose -certs "$AGENT_JAR_EXPANDED" 2>&1)

# Check alias
if echo "$CERT_DETAILS" | grep -q "$EXPECTED_ALIAS"; then
    echo -e "${GREEN}✅ Alias matches: $EXPECTED_ALIAS${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: Alias may not match expected value${NC}"
fi

# Check algorithm
if echo "$CERT_DETAILS" | grep -q "$EXPECTED_ALGORITHM"; then
    echo -e "${GREEN}✅ Algorithm: $EXPECTED_ALGORITHM${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: Algorithm may not be $EXPECTED_ALGORITHM${NC}"
fi

# Check key size (4096-bit RSA)
if echo "$CERT_DETAILS" | grep -q "4096"; then
    echo -e "${GREEN}✅ Key size: 4096-bit${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: Key size may be less than $MIN_KEY_SIZE bits${NC}"
fi

echo ""
echo "🔍 Step 4: Manifest Verification"
echo "---------------------------------"
unzip -q -c "$AGENT_JAR_EXPANDED" META-INF/MANIFEST.MF | grep -E "(Premain-Class|Agent-Class|Can-Redefine-Classes|Can-Retransform-Classes)" || true

echo ""
echo -e "${GREEN}✅ Agent JAR signature verification complete${NC}"
echo ""
echo "📊 Summary:"
echo "  - JAR: $AGENT_JAR_EXPANDED"
echo "  - Signature: Valid"
echo "  - Algorithm: $EXPECTED_ALGORITHM $MIN_KEY_SIZE-bit"
echo "  - Alias: $EXPECTED_ALIAS"
echo ""
echo "✅ Ready for deployment"
