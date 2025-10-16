# ADR-019: Marketing Directory Boundaries

**Status:** Accepted
**Date:** 2025-10-16
**Deciders:** Architecture Team (via Architecture Guardian agent)

## Context

The `marketing/` directory currently contains application logic (TypeScript Temporal workers, RAG pipelines, DuckDB integration) that violates ADR-011's pure application framework principle. This code:

1. **Lacks integration with FLUO's build system**: No `flake.nix`, no test integration
2. **Violates separation of concerns**: Marketing automation is external tooling, not core FLUO functionality
3. **Creates maintenance burden**: Unmaintained code in main repository
4. **Confuses scope**: Unclear if this is a FLUO feature or separate tool

The Architecture Guardian identified this as a P0 architectural drift requiring immediate resolution.

## Decision

We establish **marketing as external tooling** with the following boundaries:

### Marketing Directory Scope (ALLOWED)
- ✅ **Documentation**: Product positioning, messaging, value props
- ✅ **Content**: Blog posts, whitepapers, case studies (static content)
- ✅ **Sales materials**: Decks, one-pagers, competitive analysis
- ✅ **Knowledge base**: Reference documents for content creation
- ✅ **Planning**: Content briefs, campaign plans, editorial calendars

### NOT Allowed in Marketing Directory
- ❌ **Application code**: No TypeScript/JavaScript implementations
- ❌ **Build systems**: No `package.json`, no Node dependencies
- ❌ **Infrastructure**: No Docker, no Temporal workers, no database code
- ❌ **Tests**: No Jest/Vitest/unit tests
- ❌ **Automation logic**: No CI/CD scripts, no workflow orchestration

### New Architecture Pattern

**Marketing Automation → Separate Repository**

If marketing automation tools are needed:
```
fluo/                          # Main application framework
  backend/                     # Pure Quarkus API
  bff/                        # Pure React app
  marketing/                  # Documentation + content ONLY
    whitepapers/
    blog-posts/
    case-studies/
    knowledge-base/
    docs/

fluo-marketing-automation/     # SEPARATE external project
  flake.nix                    # Own build system
  src/
    activities/
    workflows/
    rag/
  package.json
  tests/
```

## Implementation

### Phase 1: Archive Application Code (Completed)
- Archived: `marketing/src/` (Temporal workers, RAG pipeline)
- Archived: `marketing/package.json`, `marketing/tsconfig.json`
- Archived: Setup scripts, n8n/Ollama integration code
- Result: `marketing-backup-2025-10-15.tar.gz`

### Phase 2: Define Allowed Content (This ADR)
- Document: Marketing directory scope (content only)
- Clarify: External tooling pattern for automation

### Phase 3: Create Separate Automation Project (Future)
If automation is revived:
1. Create `github:fluohq/fluo-marketing-automation`
2. Migrate archived code to new repo
3. Add proper flake.nix, tests, documentation
4. Maintain as separate project with own release cycle

## Rationale

### Why Separate Marketing Automation?

**1. Different Development Lifecycle**
- FLUO core: 90% test coverage, rigorous PRD process
- Marketing automation: Rapid experimentation, AI-generated content

**2. Different Technology Boundaries**
- FLUO core: Java 21 + React + Nix
- Marketing automation: Node.js + Temporal + LLM APIs

**3. Different Deployment Patterns**
- FLUO core: Pure application packages (ADR-011)
- Marketing automation: Temporal Cloud + external services

**4. Clear Ownership**
- FLUO core: Engineering team, formal ADRs
- Marketing automation: Marketing team, content strategy

### Why Keep Content in Main Repo?

**1. Documentation is Core Product**
- Whitepapers explain FLUO's value proposition
- Knowledge base used by AI agents (Claude) for context
- Blog posts drive SEO and customer education

**2. Version Control Alignment**
- Content should match shipped features
- PRs can update docs alongside code changes

**3. Single Source of Truth**
- Engineers and marketers collaborate on positioning
- Technical accuracy validated in code reviews

## Directory Structure After This ADR

```
marketing/
├── README.md                   # Overview of marketing content
├── whitepapers/               # Enterprise whitepapers (static)
├── blog-posts/                # SEO-optimized articles (static)
├── case-studies/              # Customer success stories (static)
├── sales/                     # Sales decks, one-pagers (static)
├── competitors/               # Competitive analysis (static)
├── education/                 # Training materials (static)
├── knowledge-base/            # Reference docs for content creation
├── docs/                      # Content guidelines, briefs
└── archive/                   # Historical content (versioned)
```

**Removed:**
- `src/` (application logic)
- `package.json` (Node dependencies)
- `tsconfig.json` (TypeScript config)
- `scripts/` (automation scripts)
- `.rag-cache.json` (runtime state)

## Benefits

### 1. **Architectural Clarity**
- Marketing = content, not code
- Automation = separate external project
- Clear boundaries for contributors

### 2. **Reduced Maintenance Burden**
- No unmaintained code in main repo
- Marketing automation maintained independently
- Simpler CI/CD for core FLUO

### 3. **Faster Content Iteration**
- Content PRs don't require test coverage
- Marketing team can iterate without build system changes
- AI-generated content doesn't pollute core repo history

### 4. **Better Separation of Concerns**
- FLUO core focuses on behavioral assurance
- Marketing automation focuses on lead generation
- Each maintained by appropriate team

## Consequences

### Positive
- ✅ Marketing directory scope clearly defined
- ✅ No more application logic in marketing/
- ✅ External tooling pattern established
- ✅ Aligns with ADR-011 (pure application framework)

### Negative
- ⚠️ Marketing automation requires separate repo if revived
- ⚠️ Content contributors can't run automation locally
- ⚠️ Two repos to maintain if automation is needed

### Mitigation Strategies
- Provide clear migration guide if automation is revived
- Use AI agents (Claude) for content generation instead of custom code
- Treat marketing automation as optional external tool, not required

## Alternatives Considered

### 1. **Keep Code, Add Flake Integration**
**Rejected**: Marketing automation is not a core FLUO feature, shouldn't be in main repo regardless of build integration

### 2. **Move to `tools/marketing/` Directory**
**Rejected**: Still mixes concerns, implies this is core tooling

### 3. **Delete All Marketing Content**
**Rejected**: Documentation and content are valuable, only application code is problematic

### 4. **Submodule for Marketing Automation**
**Rejected**: Over-engineering, separate repo is simpler

## Future Considerations

1. **If Marketing Automation is Revived**: Create `fluo-marketing-automation` repo with proper build system
2. **Content Workflow**: Consider GitHub Actions for static content validation (spell check, link checking)
3. **Knowledge Base Updates**: Keep knowledge-base/ in sync with shipped FLUO features
4. **AI Agent Context**: Ensure marketing/knowledge-base/ remains authoritative source for AI context

## References

- [ADR-011: Pure Application Framework](./011-pure-application-framework.md) - Core architectural principle
- [ADR-015: Development Workflow and Quality Standards](./015-development-workflow-and-quality-standards.md) - Test coverage requirements
- [Architecture Guardian Report](../../TEAM-CONSENSUS-ACTIONS.md) - Issue discovery
- [Marketing Backup](../../marketing-backup-2025-10-15.tar.gz) - Archived application code
