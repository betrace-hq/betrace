#!/bin/bash
# Fix FLUO DSL syntax across all competitor articles

# Common incorrect patterns and their corrections:

# Pattern 1: trace.attribute.subattribute == value
# Should be: trace.has(operation).where(attribute == value)

# Pattern 2: trace.agent.tool.name == "value"
# Should be: trace.has(agent.tool).where(name == value)

# Pattern 3: not (trace.auth.mfa_verified == true)
# Should be: not trace.has(auth.mfa_verified)

echo "This script documents DSL fixes needed - manual review required"
echo ""
echo "Common patterns to fix:"
echo "1. trace.X.Y == value → trace.has(X).where(Y == value)"
echo "2. not (trace.X == true) → not trace.has(X)"
echo "3. trace.X and trace.Y → trace.has(X) and trace.has(Y)"
