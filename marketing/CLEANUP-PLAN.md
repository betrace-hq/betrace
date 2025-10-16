# Marketing Directory Cleanup Plan

**Date:** October 2025
**Status:** Ready for execution

---

## Problem

The marketing directory contains:
- **Planned but never implemented** n8n/Ollama automation infrastructure
- **18MB of temporary files** (.rag-store.json, duckdb files)
- **276 node_modules directories** for automation that doesn't exist
- **Obsolete planning docs** for news aggregation system that was abandoned

**Current size:** ~200MB (mostly node_modules + temp files)
**After cleanup:** ~5-10MB (just content)

---

## What to Keep (Valuable Content)

### Core Marketing Content
```
marketing/
├── education/                    # ✅ High-conversion campaign (just created)
│   ├── README.md
│   ├── do-you-need-fluo.md
│   ├── the-oh-shit-moment.md
│   ├── understanding-invariants.md
│   ├── hidden-cost-of-violated-invariants.md
│   ├── incidents-to-invariants.md
│   ├── invariant-driven-development.md
│   ├── HIGH-CONVERSION-CONTENT-SUMMARY.md
│   ├── case-studies/README.md
│   ├── playbooks/README.md
│   └── templates/invariant-library.md
│
├── competitors/                  # ✅ 7 competitor comparisons
│   ├── README.md
│   ├── FLUO-vs-Datadog.md
│   ├── FLUO-vs-Honeycomb.md
│   ├── FLUO-vs-Drata.md
│   ├── FLUO-vs-Gremlin.md
│   ├── FLUO-vs-LangSmith.md
│   ├── FLUO-vs-Monte-Carlo.md
│   └── FLUO-vs-Cribl.md
│
├── case-studies/                 # ✅ Detailed case studies
│   └── when-grep-fails.md
│
├── marketing-articles/           # ✅ 20 SEO articles
│   ├── 01-stop-fighting-alert-fatigue...md
│   ├── ...
│   └── 20-real-time-pattern-violations...md
│
├── blog-posts/                   # ✅ Published content
│   └── ai-safety-report-behavioral-assurance.md
│
├── whitepapers/                  # ✅ Whitepaper
│   └── enterprise-ai-safety-guide.md
│
├── sales/                        # ✅ Sales materials
│   └── FLUO-Sales-Deck-Q1-2025.md
│
├── conferences/                  # ✅ Talk abstracts
│   └── talk-abstract.md
│
├── outreach/                     # ✅ Email templates
│   ├── ai-safety-institutes-email.md
│   └── linkedin-report-contributors.md
│
├── docs/                         # ✅ Content guidelines
│   ├── README.md
│   ├── SUMMARY.md
│   ├── QUICK_START.md
│   ├── ai-content-guidelines.md
│   ├── AI-SAFETY-FOR-ENTERPRISE.md
│   ├── MODEL_RECOMMENDATIONS.md
│   └── content-briefs/
│       ├── 001-trace-pattern-matching.md
│       └── 002-compliance-evidence.md
│
├── knowledge-base/               # ✅ Technical reference
│   ├── fluo-architecture.md
│   └── fluo-dsl-reference.md
│
└── README.md                     # ⚠️ Update (current one describes obsolete n8n system)
```

---

## What to Delete (Tech Debt)

### 1. Node.js Automation Infrastructure (Never Deployed)
```bash
rm -rf node_modules/              # 276 directories, ~150MB
rm package.json package-lock.json # Node deps for n8n/Ollama (not used)
rm tsconfig.json                  # TypeScript config (not used)
rm -rf scripts/                   # Automation scripts (not used)
rm -rf src/                       # Source code (not used)
rm -rf workflows/                 # n8n workflows (never implemented)
rm -rf content/                   # Empty or stale generated content
```

**Rationale:** The n8n/Ollama marketing automation was planned but never implemented. All these files support a system that doesn't exist.

---

### 2. Temporary Files (Regeneratable)
```bash
rm .rag-store.json                # 18MB RAG cache (regeneratable)
rm article-ideas.duckdb*          # Temp database
rm qualified-news.duckdb*         # Temp database
rm news-queries.csv               # Temp data
rm news-queries.json              # Temp data
rm news-queries-better.json       # Temp data
rm newsroom-output.log            # Old logs
rm idea-generation.log            # Old logs
```

**Rationale:** Temporary files from content generation experiments. Can be regenerated if needed.

---

### 3. Obsolete Planning Docs (Abandoned Projects)
```bash
rm NEWS_QUERIES.md                # News aggregation (not implemented)
rm NEWS_QUERIES_BETTER.md         # Refined news queries (not implemented)
rm NEWS_WORKFLOW.md               # Planned workflow (abandoned)
rm NEWS_WORKFLOW_SUMMARY.md       # Summary of abandoned workflow
rm TEMPORAL_NEWS_WORKFLOW.md      # Alternative approach (not used)
rm TEMPORAL_GUIDE.md              # Temporal framework (not used)
rm PROMPT_CONTEXT.md              # News generation context (obsolete)
rm AGENT_COMPARISON.md            # Agent comparison (not relevant)
rm GETTING_STARTED.md             # Getting started with n8n (obsolete)
rm STATUS.md                      # Status of automation (obsolete)
rm CHANGELOG.md                   # Automation changelog (not used)
rm COMPLETE_SYSTEM_SUMMARY.md     # System summary (obsolete)
rm DELIVERY_SUMMARY.md            # Delivery summary (obsolete)
```

**Rationale:** These docs describe a news aggregation + automation system that was planned but abandoned in favor of hand-crafted educational content.

---

### 4. Test/Review Directories (Temporary)
```bash
rm -rf test-outputs/              # Test persona outputs (validated, no longer needed)
rm -rf articles-for-review/       # Draft articles (review then delete)
```

**Rationale:** Temporary validation outputs. Content has been reviewed and incorporated into final docs.

---

### 5. Environment Files (Keep .example, Delete .env)
```bash
rm .env                           # Local env (has secrets, shouldn't be in repo)
# Keep: .env.example              # Template (no secrets)
```

**Rationale:** `.env` likely has API keys/secrets (shouldn't be in repo). `.env.example` is a template (keep).

---

## Execution Plan

### Phase 1: Backup (Safety First)
```bash
cd /Users/sscoble/Projects/fluo/marketing
tar -czf ../marketing-backup-2025-10-15.tar.gz .
# Backup stored at: /Users/sscoble/Projects/fluo/marketing-backup-2025-10-15.tar.gz
```

### Phase 2: Delete Files
```bash
# Temporary files (18MB+)
rm .rag-store.json article-ideas.duckdb* qualified-news.duckdb*
rm news-queries.* newsroom-output.log idea-generation.log

# Obsolete docs (planning for abandoned system)
rm NEWS_*.md TEMPORAL_*.md PROMPT_CONTEXT.md AGENT_COMPARISON.md
rm GETTING_STARTED.md STATUS.md CHANGELOG.md *_SUMMARY.md

# Test outputs
rm -rf test-outputs/ articles-for-review/

# Node.js infrastructure (never deployed, ~150MB)
rm -rf node_modules/ scripts/ src/ workflows/ content/
rm package*.json tsconfig.json

# Environment (has secrets)
rm .env
```

### Phase 3: Update README
Replace current README.md (describes n8n/Ollama system) with new README describing actual content.

---

## New README.md Structure

```markdown
# FLUO Marketing Content

This directory contains all marketing content for FLUO.

## Content Overview

### High-Conversion Content
- **education/** - Educational campaign (self-assessment, scenarios, case studies)
- **competitors/** - Competitor comparisons (7 articles)
- **case-studies/** - Detailed case studies with ROI analysis

### Supporting Content
- **marketing-articles/** - 20 SEO-optimized articles
- **blog-posts/** - Published blog content
- **whitepapers/** - Enterprise whitepapers
- **sales/** - Sales deck and materials
- **conferences/** - Talk abstracts and materials
- **outreach/** - Email templates for outreach

### Documentation
- **docs/** - Content guidelines, briefs, model recommendations
- **knowledge-base/** - FLUO architecture and DSL reference

## Quick Links

**High-Conversion Landing Pages:**
- [Do You Need FLUO?](./education/do-you-need-fluo.md) - Self-assessment
- [The "Oh Shit" Moment](./education/the-oh-shit-moment.md) - 5 scenarios
- [When Grep Fails](./case-studies/when-grep-fails.md) - Case study

**Competitor Comparisons:**
- [Full index](./competitors/README.md)

**Educational Content:**
- [Campaign index](./education/README.md)

## Content Status

**Ready for launch:**
- ✅ High-conversion content (3 pieces)
- ✅ Educational campaign (8 pieces)
- ✅ Competitor comparisons (7 pieces)

**Supporting content:**
- ✅ 20 SEO articles
- ✅ Sales deck
- ✅ Whitepapers

## Next Steps

1. Review high-conversion content: [Summary](./education/HIGH-CONVERSION-CONTENT-SUMMARY.md)
2. Launch self-assessment page
3. Distribute "Oh Shit" scenarios
4. Track conversion metrics
```

---

## Post-Cleanup Verification

### Check Directory Size
```bash
du -sh /Users/sscoble/Projects/fluo/marketing
# Expected: ~5-10MB (was ~200MB)
```

### Count Files
```bash
find /Users/sscoble/Projects/fluo/marketing -type f -name "*.md" | wc -l
# Expected: ~60 markdown files (valuable content)
```

### Verify Git Status
```bash
cd /Users/sscoble/Projects/fluo/marketing
git status
# Should show deletions (good - removing debt)
```

---

## Risks & Mitigation

**Risk 1:** "We might need those node_modules later"
- **Mitigation:** Backup created (tar.gz). If needed, restore from backup. But realistically, if we implement automation later, we'll use fresh dependencies (not year-old packages).

**Risk 2:** "Those planning docs have useful ideas"
- **Mitigation:** Backup created. Ideas can be extracted from backup if needed. But content-wise, the hand-crafted educational content is superior.

**Risk 3:** "The .rag-store.json took time to generate"
- **Mitigation:** It's a cache. Can be regenerated in ~5-10 minutes if needed.

---

## Decision: Execute Cleanup?

**Recommendation:** YES

**Why:**
- Removes 180MB+ of unused code/data (90% reduction)
- Clarifies what marketing actually contains (educational content, not automation)
- New README accurately describes current state
- Backup created (can restore if needed)

**When:** Now (before further work accumulates)

---

## Execution Command

```bash
# Run all cleanup commands in one go
cd /Users/sscoble/Projects/fluo/marketing && \
tar -czf ../marketing-backup-2025-10-15.tar.gz . && \
rm .rag-store.json article-ideas.duckdb* qualified-news.duckdb* news-queries.* newsroom-output.log idea-generation.log && \
rm NEWS_*.md TEMPORAL_*.md PROMPT_CONTEXT.md AGENT_COMPARISON.md GETTING_STARTED.md STATUS.md CHANGELOG.md COMPLETE_SYSTEM_SUMMARY.md DELIVERY_SUMMARY.md && \
rm -rf test-outputs/ articles-for-review/ && \
rm -rf node_modules/ scripts/ src/ workflows/ content/ && \
rm package*.json tsconfig.json && \
rm .env && \
echo "Cleanup complete. Backup: ../marketing-backup-2025-10-15.tar.gz"
```

Ready to execute?
