# Ollama Model Recommendations for BeTrace Marketing

**Updated:** 2025-10-12
**Based on:** Latest Ollama model library

## Recommended Models (2025)

### Primary: Llama 3.1:8b
**Use for:** Blog posts (1,500+ words), long-form content
**Size:** 4.7 GB
**Why:** Excellent reasoning, handles long-context tasks, proven quality
**Speed:** 2-3 min for 1,500-word blog post
**Command:** `ollama pull llama3.1:8b`

### Alternative 1: Qwen3:8b
**Use for:** Technical content, code-heavy blog posts
**Size:** ~4.5 GB
**Why:** Strong technical writing, good at code explanations
**Speed:** Similar to Llama 3.1
**Command:** `ollama pull qwen3:8b`

### Alternative 2: Gemma3:12b
**Use for:** High-quality content when you have time
**Size:** 8.1 GB (already installed: `gemma3:12b`)
**Why:** "Most capable model that runs on a single GPU" per Ollama
**Speed:** 3-5 min for 1,500-word blog post
**Command:** `ollama pull gemma3:12b`

### For Social Media: Qwen3:8b
**Use for:** LinkedIn posts, Twitter threads (200-300 words)
**Why:** Fast, concise, conversational tone
**Speed:** 30 sec for LinkedIn post
**Replaces:** Mistral:7b (Qwen3 is newer and better)

### For Code Examples: CodeLlama:7b
**Use for:** BeTrace DSL syntax, code snippets
**Size:** 3.8 GB (already installed: `codellama:7b-instruct`)
**Why:** Specialized for code generation
**Speed:** 15-30 sec for code example

## Model Comparison

| Model | Size | Best For | Speed | Quality |
|-------|------|----------|-------|---------|
| **Llama 3.1:8b** | 4.7 GB | Blog posts, reasoning | Medium | ⭐⭐⭐⭐⭐ |
| **Qwen3:8b** | 4.5 GB | Technical content, social | Fast | ⭐⭐⭐⭐ |
| **Gemma3:12b** | 8.1 GB | Premium content | Slow | ⭐⭐⭐⭐⭐ |
| **CodeLlama:7b** | 3.8 GB | Code snippets, DSL | Fast | ⭐⭐⭐⭐ |

## Workflow-Specific Recommendations

### Workflow 1: AI Blog Post Generator
**Primary:** Llama 3.1:8b
**Fallback:** Qwen3:8b (if technical post)
**Premium:** Gemma3:12b (if time allows)

**Prompt template:**
```
Generate a 1,500-word technical blog post for BeTrace (behavioral assurance for OpenTelemetry).

Target audience: SREs dealing with microservices incidents
Topic: [topic]
Tone: Technical, honest, helpful (not salesy)

Structure:
- Hook: Real incident scenario (relatable)
- Problem: Why existing tools (APM) don't solve this
- Solution: How BeTrace detects this pattern with DSL rules
- Implementation: Step-by-step with code examples
- Results: Quantified improvement (MTTR, incidents prevented)

Include:
- BeTrace DSL rule examples
- OpenTelemetry span structure
- Real-world metrics

CTA: "Try BeTrace: github.com/betracehq/betrace"
```

### Workflow 2: Social Media Cross-Posting
**Primary:** Qwen3:8b (fast, concise)
**Fallback:** Llama 3.1:8b (if need deeper reasoning)

**LinkedIn prompt:**
```
Repurpose this blog post as a 200-word LinkedIn post.

Blog: [paste blog content]

Requirements:
- Professional tone
- Key takeaway in first sentence
- 2-3 bullet points
- CTA: "Read full post: [link]"
- Include relevant hashtags: #SRE #Observability #OpenTelemetry
```

**Twitter thread prompt:**
```
Turn this blog post into an 8-tweet thread.

Blog: [paste blog content]

Requirements:
- Technical but accessible
- Each tweet 280 chars max
- Include code snippet if relevant (tweet 3-4)
- Final tweet: CTA + link
- Engaging hooks, no buzzwords
```

### Workflow 4: Case Study Generation
**Primary:** Llama 3.1:8b (best at extracting insights)
**Fallback:** Qwen3:8b (if technical implementation details)

**Prompt template:**
```
Turn this customer interview transcript into a 1,200-word case study.

Transcript: [paste Otter.ai output]

Template:
## [Company] Reduces MTTR by X% with BeTrace

### Company Overview
- Industry: [extract]
- Team size: [extract]
- Tech stack: [extract]

### The Challenge
[2-3 paragraphs: pain point, existing tools, business impact]

### The Solution
[BeTrace implementation: timeline, rules created, integration]

### The Results
[Quantified outcomes: MTTR, incidents, hours saved]
[Customer quote from transcript]

### Technical Details
[BeTrace DSL rules used]

Tone: Technical, honest, no exaggeration
```

## Testing Model Quality

### Step 1: Test Locally Before n8n
```bash
# Test blog post generation
ollama run llama3.1:8b "Generate 5 blog post ideas for BeTrace..."

# Test social media
ollama run qwen3:8b "Write a 200-word LinkedIn post about behavioral assurance..."

# Test code generation
ollama run codellama:7b "Write a BeTrace DSL rule that detects missing auth checks..."
```

### Step 2: Evaluate Output
**Quality Checklist:**
- ✅ Technical accuracy (8/10 minimum)
- ✅ Appropriate tone (not salesy)
- ✅ Correct structure (clear sections)
- ✅ Code examples work (if applicable)
- ✅ No hallucinations (factual claims are accurate)

### Step 3: Iterate on Prompts
If quality < 8/10:
1. Add more context to prompt
2. Specify structure more clearly
3. Include examples in prompt
4. Try different model (Qwen3 vs Llama 3.1)

## Model Installation

### Recommended Setup
```bash
cd marketing

# Pull all recommended models (~18 GB total)
ollama pull llama3.1:8b      # 4.7 GB
ollama pull qwen3:8b          # 4.5 GB
ollama pull gemma3:12b        # 8.1 GB
ollama pull codellama:7b      # 3.8 GB

# Or use npm script (pulls all at once)
npm run ollama:pull
```

### Minimal Setup (if limited disk space)
```bash
# Just the essentials (~8.5 GB)
ollama pull llama3.1:8b       # Blog posts
ollama pull qwen3:8b          # Social media + technical
```

### Premium Setup (if have disk space + RAM)
```bash
# Add larger models for best quality
ollama pull llama3.1:70b      # 40 GB, best reasoning (requires 64GB RAM)
ollama pull gemma3:27b        # 16 GB, excellent quality (requires 32GB RAM)
```

## Hardware Requirements

| Model | Min RAM | Recommended RAM | Speed |
|-------|---------|-----------------|-------|
| Llama 3.1:8b | 8 GB | 16 GB | Medium |
| Qwen3:8b | 8 GB | 16 GB | Fast |
| Gemma3:12b | 16 GB | 24 GB | Slow |
| CodeLlama:7b | 8 GB | 16 GB | Fast |

**Your System:** Check with `ollama ps` while running models

## Performance Benchmarks

**Blog Post (1,500 words):**
- Llama 3.1:8b: 2-3 minutes
- Qwen3:8b: 2-3 minutes
- Gemma3:12b: 3-5 minutes

**Social Media Post (200 words):**
- Qwen3:8b: 30 seconds
- Llama 3.1:8b: 45 seconds

**Code Example (20 lines):**
- CodeLlama:7b: 15 seconds
- Qwen3:8b: 30 seconds

## Switching Models in n8n

### Update HTTP Request Node
```json
{
  "url": "http://localhost:11434/api/generate",
  "method": "POST",
  "body": {
    "model": "qwen3:8b",  // Change this
    "prompt": "[your prompt]",
    "stream": false
  }
}
```

### A/B Test Models
Create two workflow versions:
- Workflow 1A: Uses Llama 3.1:8b
- Workflow 1B: Uses Qwen3:8b

Compare:
- Output quality (human rating 1-10)
- Speed (time to generate)
- Tone consistency

Keep best performer.

## Troubleshooting

### Model Not Found
```bash
# Check installed models
ollama list

# Pull missing model
ollama pull llama3.1:8b
```

### Out of Memory
```bash
# Check running models
ollama ps

# Stop unused models (they auto-stop after 5 min idle)
# Or use smaller model (Qwen3:8b instead of Gemma3:12b)
```

### Slow Generation
```bash
# Check system resources
top  # Look for ollama process

# Use faster model
# Qwen3:8b > Llama 3.1:8b > Gemma3:12b (speed)
```

## Future Models to Watch

**2025 Releases:**
- **DeepSeek-R1:14b** - Strong reasoning (already installed!)
- **Qwen3-Coder:14b** - Better code generation
- **Llama 3.2:latest** - Latest Meta release (already installed!)

**Check for updates:**
```bash
# See new models on Ollama
open https://ollama.com/search

# Update installed models
ollama pull llama3.1:8b  # Gets latest version
```

## References

- [Ollama Model Library](https://ollama.com/search)
- [Ollama Documentation](https://ollama.com/docs)
- [PRD-111: n8n Marketing Automation](../docs/prds/PRD-111-n8n-marketing-automation.md)
- [Model Benchmarks](https://ollama.com/blog/llama31)
