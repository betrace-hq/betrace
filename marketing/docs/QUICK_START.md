# Quick Start: AI Content Generation

**Time to first article:** ~15 minutes

---

## Prerequisites

1. **Ollama installed with models:**
   ```bash
   ollama pull llama3.1:8b
   ollama pull nomic-embed-text
   ```

2. **Embeddings built:**
   ```bash
   cd marketing
   npm run build:embeddings
   ```

3. **Pick a topic:** Use existing content brief or create new one

---

## Generate Content (3 Steps)

### Step 1: Choose Your Topic

**Option A: Use existing brief**
- [Trace Pattern Matching](content-briefs/001-trace-pattern-matching.md)
- [Compliance Evidence](content-briefs/002-compliance-evidence.md)

**Option B: Create new brief**
- Copy template from [content-briefs/001-trace-pattern-matching.md](content-briefs/001-trace-pattern-matching.md)
- Fill in: Required reading, Documented facts, Structure, Constraints
- Save as `content-briefs/00X-topic-name.md`
- Rebuild embeddings: `npm run build:embeddings`

### Step 2: Run AI Newsroom

```bash
cd marketing

# Generate 20 author perspectives (takes ~10 minutes)
npx tsx scripts/ai-newsroom.ts
```

**Output:**
- `test-outputs/skeptical-engineer.md` ⭐ **Most trustworthy**
- `test-outputs/forensic-investigator.md`
- `test-outputs/storytelling-journalist.md`
- ... (14 more)

### Step 3: Review & Select Winners

```bash
# Read comparison
cat test-outputs/COMPARISON.md

# Review top performers
cat test-outputs/skeptical-engineer.md
cat test-outputs/api-documentarian.md
cat test-outputs/changelog-chronicler.md
```

**Evaluation criteria:**
1. Factual accuracy (no invented features/syntax)
2. Citations (all claims sourced)
3. Honesty (acknowledges gaps)
4. No hallucinations (code matches docs)

---

## Common Workflows

### Workflow 1: Blog Post (Safe Topics)

**Best for:** Well-documented features (DSL, architecture, compliance)

```bash
# 1. Pick a well-documented topic
cat docs/content-briefs/001-trace-pattern-matching.md

# 2. Generate drafts
npx tsx scripts/ai-newsroom.ts

# 3. Select Skeptical Engineer output
cat test-outputs/skeptical-engineer.md

# 4. Human fact-check (30 minutes)
# - Verify DSL syntax matches trace-rules-dsl.md
# - Check all citations are real files
# - Validate no invented examples

# 5. Publish!
```

**Time:** 15 min generation + 30 min review = **45 minutes total**

### Workflow 2: Blog Post (Risky Topics)

**Best for:** Poorly-documented features (may expose gaps)

```bash
# 1. Generate drafts (expect "not documented" responses)
npx tsx scripts/ai-newsroom.ts

# 2. Review Skeptical Engineer for gaps
cat test-outputs/skeptical-engineer.md
# Look for: "The docs don't specify...", "Would not use..."

# 3. Decision point:
#    - If too many gaps → Document the feature first!
#    - If honest gaps are OK → Use Skeptical Engineer draft
#    - If need narrative → Combine Skeptical + Storytelling

# 4. Heavy human editing required (1-2 hours)
# 5. Publish with disclaimers
```

**Time:** 15 min generation + 2 hours editing = **2+ hours total**

### Workflow 3: Technical Documentation

**Best for:** API docs, tutorials, integration guides

```bash
# 1. Use API Documentarian or Changelog Chronicler
npx tsx scripts/ai-newsroom.ts

# 2. Review technical accuracy
cat test-outputs/api-documentarian.md

# 3. Verify all code examples against source
# - Read trace-rules-dsl.md
# - Compare line-by-line

# 4. Minimal editing needed (if accurate)
# 5. Publish
```

**Time:** 15 min generation + 20 min verification = **35 minutes total**

### Workflow 4: Hybrid Approach (Best Quality)

**Combine strengths of multiple agents**

```bash
# 1. Generate all 20 perspectives
npx tsx scripts/ai-newsroom.ts

# 2. Extract facts from Skeptical Engineer
cat test-outputs/skeptical-engineer.md
# Copy: Technical claims, DSL examples, honest gaps

# 3. Extract narrative from Storytelling Journalist
cat test-outputs/storytelling-journalist.md
# Copy: Opening hook, structure, flow

# 4. Merge: Storytelling structure + Skeptical facts
# (Manual editing required)

# 5. Validate merged content
# - All facts from Skeptical are cited
# - Narrative doesn't add unverified claims

# 6. Publish hybrid article
```

**Time:** 15 min generation + 1 hour merging = **1.25 hours total**

---

## Quality Checklist

Before publishing ANY AI-generated content:

### ✅ Factual Accuracy
- [ ] All DSL examples match [trace-rules-dsl.md](../../docs/technical/trace-rules-dsl.md)
- [ ] All ADR references are real files
- [ ] No invented helper functions or syntax
- [ ] Performance claims have citations or say "not benchmarked"

### ✅ Architectural Accuracy
- [ ] BeTrace shown as deployed service (NOT library)
- [ ] No `import betrace from '@betrace/sdk'` (doesn't exist!)
- [ ] Deployment uses Nix or external tools
- [ ] Rules configured in BeTrace UI (not app code)

### ✅ Compliance Honesty
- [ ] No "SOC2 certified" claims (NOT TRUE)
- [ ] No "HIPAA compliant" claims (NOT TRUE)
- [ ] States "provides evidence primitives" (CORRECT)
- [ ] Mentions 12-18 month timeline + $10-25K cost if discussing certification

### ✅ Citations
- [ ] Every technical claim cites source: `[Source: filename.md]`
- [ ] All code examples have file references
- [ ] No unsourced statistics or benchmarks

### ✅ Gaps Acknowledged
- [ ] Missing docs noted: "Not yet documented..."
- [ ] No benchmarks stated: "No public benchmarks available"
- [ ] Limitations acknowledged honestly

---

## Troubleshooting

### Problem: AI invents DSL syntax

**Cause:** LLM's pretrained knowledge overrides RAG context

**Fix:**
1. Check [ai-content-guidelines.md](ai-content-guidelines.md) has correct examples
2. Ensure embeddings rebuilt: `npm run build:embeddings`
3. Use Skeptical Engineer (refuses to invent)
4. Add post-generation validation

### Problem: AI claims SOC2 certification

**Cause:** RAG didn't retrieve [compliance-status.md](../../docs/compliance-status.md)

**Fix:**
1. Verify compliance-status.md indexed: `ls ../../docs/compliance-status.md`
2. Check [content-briefs/002-compliance-evidence.md](content-briefs/002-compliance-evidence.md)
3. Rebuild embeddings
4. Use Compliance Auditor agent (if available)

### Problem: AI shows BeTrace as library

**Cause:** Didn't retrieve [ai-content-guidelines.md](ai-content-guidelines.md) Rule 4

**Fix:**
1. Verify AI guidelines indexed
2. Check RAG search results for "import betrace"
3. Use API Documentarian or Operator/Practitioner agents

### Problem: All agents refuse to write

**Cause:** Topic is poorly documented (good sign!)

**Response:**
1. Document the feature first in `/docs/technical/`
2. Update [ai-content-guidelines.md](ai-content-guidelines.md)
3. Rebuild embeddings
4. Try again

---

## Tips for Best Results

### ✅ DO
- Use well-documented topics (DSL, architecture, compliance)
- Prefer Skeptical Engineer for accuracy
- Combine agents for quality (Skeptical facts + Storytelling narrative)
- Always human review before publishing
- Update AI docs after BeTrace releases

### ❌ DON'T
- Publish AI content without review
- Test on poorly-documented features (exposes gaps)
- Trust creative agents (Storytelling, Conference Speaker) without fact-check
- Skip the quality checklist
- Forget to rebuild embeddings after doc updates

---

## Examples

### Good Output (Skeptical Engineer)
```markdown
**What They Claim**
BeTrace Detects Authentication Retry Storms in Microservices.

**What I Verified**
* The system processes OpenTelemetry spans [Source: ADR-012]
* BeTrace consists of multiple microservices [Source: ADR-011]

**What's Missing**
* How BeTrace detects authentication retry storms is not specified.
* No benchmarks or performance metrics provided.

**Would I Use This?**
Based on the documentation alone, I would not use this system.
```
✅ **Honest, accurate, cited**

### Bad Output (Invented Example)
```javascript
// ❌ WRONG - Not in docs!
invariant "AuthRetryStorm" {
  hasRepeatedRequests(
    requestHeaders { contains "Authorization" }
  );
}
```
❌ **Invented syntax, doesn't match trace-rules-dsl.md**

### Fixed Output
```javascript
// ✅ CORRECT - From trace-rules-dsl.md
trace.has(span => span.name === 'auth.login' && span.status === 'ERROR')
  .and(trace.has(span => span.name === 'auth.login' && span.status === 'OK'))
  .within('5 seconds')
```
✅ **Real DSL syntax**

---

## Next Steps

1. **Try it now:**
   ```bash
   npx tsx scripts/ai-newsroom.ts
   ```

2. **Read outputs:**
   ```bash
   ls test-outputs/*.md
   ```

3. **Select winner:**
   - Skeptical Engineer = most trustworthy
   - API Documentarian = technical reference
   - Storytelling Journalist = engaging (but fact-check!)

4. **Human review:**
   - Use quality checklist above
   - Verify all claims against source docs

5. **Publish!**

---

**Questions?** See [README.md](README.md) or [SUMMARY.md](SUMMARY.md)
