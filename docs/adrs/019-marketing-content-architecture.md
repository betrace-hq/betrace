# ADR-019: Marketing Content Generation Boundaries

**Status:** Accepted
**Date:** 2025-10-23
**Deciders:** Architecture Team, Product Team

## Context

The `marketing/` directory contains a mix of:
1. **Static documentation** (whitepapers, education guides, competitor analysis) ✅ Acceptable
2. **Application logic** (TypeScript workflows, DuckDB databases, automated content generation) ❌ Violates ADR-011

### Problem Statement

The marketing directory has evolved into a mini-application with:
- `marketing/src/` - TypeScript codebase for content generation
- `marketing/scripts/` - Build and automation scripts
- `marketing/*.duckdb` - Database files for RAG/embeddings
- `marketing/package.json` - Node.js dependencies

**This violates ADR-011: Pure Application Framework** because:
- Marketing has application logic without proper flake builds
- Marketing has runtime dependencies (DuckDB) not managed by Nix
- Marketing has test infrastructure separate from main test runner
- Creates confusion: Is BeTrace a telemetry platform or content automation platform?

### Team Consensus (5/5 Agree)

- **Product Analyst:** "Marketing should **consume** BeTrace, not **implement** features. If marketing needs automation, it should be a separate product that uses BeTrace packages."
- **Implementation Specialist:** "Separation of concerns violated. Application logic belongs in versioned, tested packages."
- **Architecture Guardian:** "No flake.nix, no dev shell, no test integration = not following project standards"
- **Security Expert:** "Unreviewed code paths, potential injection risks in content generation"
- **QA Expert:** "Tests not integrated with project test runner, coverage unknown"

## Decision

**Marketing content generation is EXTERNAL TOOLING** and must be moved to a separate repository.

### What STAYS in `marketing/` (Documentation Only)

```
marketing/
├── whitepapers/          # ✅ Markdown documentation
├── education/            # ✅ Educational content
├── competitors/          # ✅ Competitive analysis
├── docs/                 # ✅ Static documentation
├── images/               # ✅ Assets
└── README.md             # ✅ Index of marketing materials
```

### What MOVES to `betrace-marketing-automation` (Separate Repo)

```
betrace-marketing-automation/
├── src/                  # TypeScript content generation
├── scripts/              # Build and automation
├── embeddings/           # DuckDB databases
├── flake.nix             # Proper Nix flake
├── package.json          # Node.js dependencies
├── tests/                # Integrated test suite
└── README.md             # Setup and usage
```

## Rationale

### Why Separate Repository?

1. **Architectural Clarity**
   - BeTrace = Behavioral assurance system
   - Marketing automation = Content generation tool
   - Different purposes, different repositories

2. **ADR-011 Compliance**
   - Marketing automation CAN have a proper flake.nix
   - CAN integrate with project test infrastructure
   - CAN follow development standards
   - But doesn't pollute the core BeTrace repo

3. **Consumption Model**
   - If marketing automation needs BeTrace features (RAG over traces, pattern matching), it should:
     ```nix
     # betrace-marketing-automation/flake.nix
     inputs.betrace.url = "github:betracehq/betrace";
     # Use betrace.packages.${system}.backend as library
     ```

4. **Independent Versioning**
   - Marketing automation can evolve independently
   - Different release cadence than core product
   - Different stakeholders (marketing vs engineering)

## Consequences

### Positive

- ✅ **BeTrace repo focus restored**: Only behavioral assurance code
- ✅ **Marketing automation gets proper infrastructure**: Flake, tests, CI
- ✅ **Clear boundaries**: BeTrace = product, Marketing automation = tool
- ✅ **ADR-011 compliance**: No application logic without proper build/test integration

### Negative

- ⚠️ **Migration effort**: ~2-4 hours to move files and set up new repo
- ⚠️ **Two repos to maintain**: Increased coordination overhead

### Neutral

- 🔄 **Marketing content stays**: Whitepapers, docs, education remain in BeTrace repo
- 🔄 **Automation externalized**: Content generation becomes a separate tool

## Migration Plan

### Phase 1: Create Separate Repository (1 hour)

```bash
# Create new repo
mkdir ../betrace-marketing-automation
cd ../betrace-marketing-automation
git init

# Initialize proper Nix flake
cat > flake.nix << 'EOF'
{
  description = "BeTrace Marketing Automation - Content Generation Tool";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    betrace.url = "github:betracehq/betrace";  # Consume BeTrace as library
  };

  outputs = { self, nixpkgs, flake-utils, betrace }:
    flake-utils.lib.eachDefaultSystem (system: {
      packages.default = /* marketing automation package */;
      devShells.default = /* dev environment */;
    });
}
EOF

# Set up Node.js project
npm init -y
```

### Phase 2: Move Files (30 minutes)

```bash
cd /Users/sscoble/Projects/betrace

# Move application logic to new repo
git mv marketing/src/ ../betrace-marketing-automation/
git mv marketing/scripts/ ../betrace-marketing-automation/
git mv marketing/package.json ../betrace-marketing-automation/
git mv marketing/*.duckdb ../betrace-marketing-automation/
git mv marketing/tsconfig.json ../betrace-marketing-automation/

# Commit in BeTrace repo
git commit -m "refactor: extract marketing automation to separate repository

Per ADR-019: Marketing Content Architecture
- Moved: TypeScript src, scripts, DuckDB to betrace-marketing-automation
- Kept: Whitepapers, docs, education (static content only)
- Rationale: ADR-011 compliance, separation of concerns"
```

### Phase 3: Update Documentation (30 minutes)

```bash
# Update BeTrace marketing/README.md
cat > marketing/README.md << 'EOF'
# BeTrace Marketing Materials

Static marketing content for BeTrace behavioral assurance platform.

## Contents

- `whitepapers/` - Technical whitepapers and case studies
- `education/` - Educational content and tutorials
- `competitors/` - Competitive analysis
- `docs/` - Static documentation

## Marketing Automation

Content generation automation has been moved to:
**https://github.com/betracehq/betrace-marketing-automation**

If you need to generate marketing content, see that repository.
EOF

# Commit
git add marketing/README.md
git commit -m "docs: update marketing README to reflect automation extraction"
```

### Phase 4: Set Up CI for Marketing Automation (1 hour)

In `betrace-marketing-automation` repository:
- Add GitHub Actions for tests
- Add Nix flake checks
- Integrate with BeTrace as library dependency

## Acceptance Criteria

- [ ] `marketing/` contains only static content (markdown, images, PDFs)
- [ ] `betrace-marketing-automation` has proper flake.nix
- [ ] Marketing automation has integrated test suite
- [ ] Marketing automation consumes BeTrace via flake inputs (if needed)
- [ ] ADR-019 documented and committed

## References

- [ADR-011: Pure Application Framework](./011-pure-application-framework.md)
- [ADR-015: Development Workflow and Quality Standards](./015-development-workflow-and-quality-standards.md)
- [TEAM-CONSENSUS-ACTIONS.md](../../TEAM-CONSENSUS-ACTIONS.md) - 5/5 agent consensus
