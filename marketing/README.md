# FLUO Marketing Automation

**Zero-budget marketing infrastructure powered by n8n + Ollama**

## Overview

This directory contains all marketing automation infrastructure for FLUO:
- **n8n workflows** - Automated content generation, social posting, email campaigns
- **Ollama integration** - Local LLM for AI-generated content
- **Human-in-the-loop** - All public publishing requires manual approval

## Architecture

```
marketing/
├── package.json          # Node.js dependencies (n8n, scripts)
├── workflows/            # n8n workflow JSON exports
│   ├── 01-blog-generator.json
│   ├── 02-social-crosspost.json
│   ├── 03-email-drip.json
│   ├── 04-case-study-pipeline.json
│   ├── 05-lead-scoring.json
│   ├── 07-hackernews-submit.json
│   └── 08-analytics-report.json
├── scripts/              # Workflow management scripts
│   ├── export-workflows.js
│   └── import-workflows.js
├── content/              # AI-generated content (for review)
│   ├── blog-drafts/
│   ├── social-posts/
│   └── case-studies/
└── docs/                 # Marketing automation docs
    └── workflow-guide.md
```

## Quick Start

### 1. Install Dependencies

```bash
cd marketing
npm install
```

### 2. Install Ollama

```bash
npm run ollama:install
npm run ollama:pull  # Downloads llama3.1:8b, mistral:7b, codellama:7b
```

### 3. Start n8n + Ollama

```bash
npm run dev
# Opens n8n UI: http://localhost:5678
# Ollama API: http://localhost:11434
```

### 4. Set Up n8n Credentials

In n8n UI, configure:
- GitHub API (for blog publishing)
- LinkedIn API (for social posting)
- Twitter API v2 (for social posting)
- SendGrid API (for emails)
- PostHog API (for analytics)
- Notion API (for CRM)

## Workflows

### Workflow 1: AI Blog Post Generator
**Trigger:** Weekly cron (Monday 9am) OR manual
**Human Approval:** GitHub PR review required before publish

**Flow:**
1. Ollama generates 5 blog topics
2. Selects first topic
3. Ollama writes 1,500-word blog post
4. Creates GitHub PR in `blog/` directory
5. **STOPS** - Human reviews PR, approves/edits
6. When PR merged, triggers Workflow 2 (social cross-posting)

### Workflow 2: Social Media Cross-Posting
**Trigger:** GitHub PR merged (blog post) OR manual
**Human Approval:** Manual approval gate in n8n before posting

**Flow:**
1. Fetches blog post from GitHub
2. Ollama generates LinkedIn post (200 words)
3. Ollama generates Twitter thread (8 tweets)
4. **STOPS** - Human approves via n8n UI
5. Posts to LinkedIn, Twitter (after approval)
6. Optionally submits to HackerNews (Workflow 7)

### Workflow 3: Email Drip Campaign
**Trigger:** PostHog `newsletter_signup` event
**Human Approval:** Email templates pre-approved, personalization auto

**Flow:**
1. User signs up for newsletter
2. Day 0: Send welcome email (pre-approved template)
3. Day 3: Personalized content recommendations (Ollama, not sent directly)
4. Day 7: Case study highlight (pre-approved)
5. Day 14: Trial offer (pre-approved)
6. All emails use pre-approved templates, Ollama only personalizes

### Workflow 4: Case Study Generation
**Trigger:** Manual (after customer interview)
**Human Approval:** Multiple gates (customer + human editor)

**Flow:**
1. Upload Otter.ai transcript
2. Ollama extracts key metrics
3. Ollama generates case study draft (1,200 words)
4. **STOP 1** - Human reviews draft
5. Send to customer for approval
6. **STOP 2** - Customer approves/edits
7. **STOP 3** - Human manually publishes to blog
8. Trigger Workflow 2 for social cross-posting

### Workflow 7: HackerNews Submission
**Trigger:** Manual (after blog post published)
**Human Approval:** Full manual control

**Flow:**
1. Ollama checks if post is HN-worthy
2. Ollama generates optimized HN title
3. Ollama generates first comment
4. **STOPS** - Human reviews title/comment
5. **Human manually submits to HN** (not automated)

### Workflow 8: Weekly Analytics Report
**Trigger:** Weekly cron (Monday 9am)
**Human Approval:** Internal only, no public publishing

**Flow:**
1. Fetches PostHog metrics
2. Fetches social media stats
3. Ollama summarizes data
4. Creates Notion report page
5. Sends Slack notification (internal team only)

## Human-in-the-Loop Gates

**All public content requires human approval:**

✅ **Blog Posts:** GitHub PR review (approve/edit/reject)
✅ **Social Media:** Manual approval in n8n UI before posting
✅ **HackerNews:** Human manually submits (Ollama drafts only)
✅ **Case Studies:** Customer approval + human editor approval
✅ **Email Templates:** Pre-approved once, Ollama personalizes
✅ **Workflows:** Human reviews before sharing publicly

**Internal automation (no approval):**
✅ Analytics reports (Slack/Notion only)
✅ Lead scoring (CRM updates)
✅ Content drafts (saved for review)

## Ollama Models

**Installed:**
- `llama3.1:8b` - Best quality, blog posts (2-3 min)
- `mistral:7b` - Fast, social media (30 sec)
- `codellama:7b` - Code examples, DSL syntax

**Usage:**
```bash
# Test prompts locally before adding to n8n
ollama run llama3.1:8b "Generate 5 blog post ideas for FLUO..."

# Check model performance
ollama list
```

## Development

### Export Workflows
```bash
npm run workflows:export
# Saves all workflows to workflows/ directory
```

### Import Workflows
```bash
npm run workflows:import
# Imports workflows from workflows/ directory into n8n
```

### Test Ollama Prompts
```bash
# In marketing directory
node scripts/test-prompts.js
```

## Monitoring

**n8n Execution History:**
- Access: http://localhost:5678/executions
- Shows all workflow runs, successes, failures

**Ollama Logs:**
```bash
journalctl -u ollama -f  # If installed as service
# Or check terminal where `npm run dev` is running
```

## Cost Breakdown

| Service | Cost | Notes |
|---------|------|-------|
| n8n (self-hosted) | $0 | Node.js package |
| Ollama (local) | $0 | Runs on existing hardware |
| PostHog Free | $0 | 1M events/month |
| SendGrid Free | $0 | 100 emails/day |
| LinkedIn API | $0 | 100 posts/day |
| Twitter API Basic | $0 | 1,500 posts/month |
| Notion API | $0 | Unlimited pages |
| **Total** | **$0/month** | |

**Hardware Requirements:**
- 16GB RAM (for llama3.1:8b)
- 8GB RAM (for mistral:7b minimum)

## References

- [PRD-111: n8n Marketing Automation](../docs/prds/PRD-111-n8n-marketing-automation.md)
- [PRD-110: Zero-Budget Marketing](../docs/prds/PRD-110-zero-budget-marketing-strategy.md)
- [n8n Documentation](https://docs.n8n.io/)
- [Ollama Documentation](https://ollama.com/docs)

## Next Steps

1. Run `npm install`
2. Run `npm run setup` (installs Ollama + models)
3. Run `npm run dev` (starts n8n + Ollama)
4. Access n8n: http://localhost:5678
5. Import workflows: `npm run workflows:import`
6. Configure API credentials in n8n
7. Test Workflow 1 (AI Blog Generator) manually
8. Review generated content, iterate on prompts
9. Enable workflows with human approval gates
10. Start automating! 🚀
