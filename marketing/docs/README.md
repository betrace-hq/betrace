# BeTrace Marketing AI Documentation

This directory contains **AI-optimized documentation** specifically designed for LLM-based content generation via RAG (Retrieval Augmented Generation).

## Purpose

Human documentation (ADRs, CLAUDE.md, technical docs) is optimized for developers. This creates problems when AI agents generate marketing content:

1. **Hallucinations** - LLMs invent features, examples, and syntax
2. **Incorrect Claims** - AI overstates capabilities (e.g., "SOC2 certified")
3. **Wrong Architecture** - AI shows BeTrace as a library instead of a service
4. **Missing Context** - AI doesn't know what to say vs NOT say

**Solution:** Create AI-optimized docs that explicitly state:
- What BeTrace is (and is NOT)
- Exact syntax to use (with examples)
- What claims are acceptable vs forbidden
- How to acknowledge gaps honestly

## Structure

### [ai-content-guidelines.md](ai-content-guidelines.md)
**Core AI writing rulebook**

Contains:
- What BeTrace actually is (deployed service, NOT library)
- Real DSL syntax (copy-pasteable examples)
- What to say vs NOT say (compliance, pricing, etc.)
- Competitive positioning (honest comparison)
- Article structure templates
- Critical writing rules (no invented examples!)

**When to use:** Every AI content generation task

### [content-briefs/](content-briefs/)
**Topic-specific content briefs**

Each brief provides:
- Required reading (which docs to use)
- Documented facts (what's true)
- Article structure (section-by-section guidance)
- Critical constraints (must do / must not do)
- Success criteria (how to evaluate)

**Available briefs:**
- [001-trace-pattern-matching.md](content-briefs/001-trace-pattern-matching.md) - DSL and pattern matching
- [002-compliance-evidence.md](content-briefs/002-compliance-evidence.md) - Compliance (BRUTALLY HONEST)

## How It Works

### 1. RAG Indexing
The marketing knowledge base indexes:
- BeTrace core docs (CLAUDE.md, ADRs, compliance.md, trace-rules-dsl.md)
- **AI-optimized docs** (this directory)
- **Excludes:** PRDs (internal planning documents)

### 2. AI Content Generation
When generating content:
1. RAG retrieves relevant documentation + AI guidelines
2. AI agents (20 different perspectives) generate drafts
3. Content is evaluated for:
   - Factual accuracy (no hallucinations)
   - Citation of sources
   - Honest acknowledgment of gaps
   - Correct architectural representation

### 3. Quality Assurance
**Skeptical Senior Engineer** agent is the gold standard:
- Refuses to make claims without documentation
- Explicitly states "The docs don't specify..."
- Provides actionable recommendations for missing info
- Scores content harshly but fairly

## Adding New Content Briefs

Template structure:
```markdown
# Content Brief: [Topic]

**Topic:** [Specific, actionable topic]
**Target Audience:** [SREs, Compliance Officers, etc.]
**Word Count:** [Range]
**Tone:** [Technical, honest, etc.]

## Required Reading for AI Agents
[List specific source files]

## Documented Facts (Use These)
[Exact quotes, code examples, claims from docs]

## Article Structure
[Section-by-section guidance]

## Critical Constraints (AI Must Follow)
### ✅ MUST DO
### ❌ MUST NOT DO
### 🚨 IF YOU NEED SOMETHING NOT IN DOCS

## Success Criteria
[How to evaluate the article]

## Review Checklist
[Pre-publish verification]
```

## Critical Rules for AI Agents

### Rule 1: NO INVENTED EXAMPLES
If you need an example NOT in the documentation:
```
[EXAMPLE NEEDED: describe what's missing]
```
**DO NOT INVENT IT!**

### Rule 2: CITE SOURCES
Every technical claim must cite:
```
[Source: trace-rules-dsl.md]
[Source: ADR-011]
[Source: compliance-status.md]
```

### Rule 3: ACKNOWLEDGE GAPS
If documentation is silent:
```
"The documentation doesn't specify..."
"No benchmarks available yet..."
"This is not yet implemented..."
```

### Rule 4: NO LIBRARY IMPORTS
BeTrace is a **deployed service**, NOT a library:
```javascript
// ❌ WRONG - This doesn't exist!
import fluo from '@fluo/sdk';

// ✅ CORRECT - Send traces to BeTrace service
const exporter = new OTLPTraceExporter({
  url: 'http://fluo-service:4318/v1/traces',
});
```

### Rule 5: COMPLIANCE HONESTY
```
✅ "BeTrace provides compliance evidence collection primitives"
❌ "BeTrace is SOC2 certified" (NOT TRUE!)
```

## Testing & Validation

### Rebuild Embeddings
After updating AI docs:
```bash
cd marketing
rm -f .rag-store.json .rag-store.duckdb*
npm run build:embeddings
```

### Test Content Generation
```bash
npx tsx scripts/ai-newsroom.ts
```

**Review:** [test-outputs/COMPARISON.md](../test-outputs/COMPARISON.md)

### Winning Author Agents
- **Skeptical Senior Engineer** - Most trustworthy, refuses unsupported claims
- **Forensic Investigator** - Evidence-driven, but watch for invented examples
- **API Documentarian** - Technical reference style

## Maintenance

### When to Update AI Docs

1. **New BeTrace feature shipped** → Update ai-content-guidelines.md with documented capabilities
2. **Compliance status changes** → Update content-briefs/002-compliance-evidence.md
3. **DSL syntax changes** → Update ai-content-guidelines.md DSL examples
4. **New use case documented** → Create new content brief

### Version Control
- AI docs live in `/marketing/docs/`
- Tracked in Git (versioned with code)
- Rebuild embeddings after changes
- Test with ai-newsroom.ts

## References

- [AI Newsroom Script](../scripts/ai-newsroom.ts) - Generates 20 author perspectives
- [Test Outputs](../test-outputs/) - Generated articles and comparisons
- [RAG System](../src/rag/) - Vector store and embeddings
- [Knowledge Base](../src/activities/knowledge-base.ts) - RAG configuration

---

**Last Updated:** 2025-10-13
**Canonical Sources:** ADR-011, CLAUDE.md, compliance-status.md, trace-rules-dsl.md
