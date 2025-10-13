# Getting Started with FLUO Marketing Automation

## What Was Built

You now have a complete **zero-budget marketing automation infrastructure** using:
- **n8n** - Self-hosted workflow automation
- **Ollama** - Local LLM (no API costs)
- **Human-in-the-loop** - All public content requires approval

## Project Structure

```
marketing/
├── package.json          # n8n + dependencies
├── .env.example          # API keys template
├── scripts/
│   └── setup.sh          # One-command setup
├── workflows/            # n8n workflow templates (to be created)
├── content/              # AI-generated drafts (for review)
│   ├── blog-drafts/
│   ├── social-posts/
│   └── case-studies/
└── docs/
    └── workflow-guide.md
```

## Quick Start (5 Minutes)

### Step 1: Run Setup Script

```bash
cd marketing
./scripts/setup.sh
```

This will:
- Install Ollama (if needed)
- Pull AI models (llama3.1:8b, mistral:7b, codellama:7b)
- Install n8n via npm
- Create .env file

### Step 2: Configure API Keys

```bash
cp .env.example .env
nano .env  # Or use your editor
```

Required APIs (all have free tiers):
- GitHub (blog publishing)
- LinkedIn (social posting)
- Twitter (social posting)
- SendGrid (emails)
- PostHog (analytics)
- Notion (CRM)

### Step 3: Start n8n + Ollama

```bash
npm run dev
```

This starts:
- Ollama API: http://localhost:11434
- n8n UI: http://localhost:5678

### Step 4: Test Ollama

```bash
# In another terminal
ollama run llama3.1:8b "Generate 5 blog post ideas for FLUO (behavioral assurance for OpenTelemetry)"
```

You should see AI-generated content!

## Next Steps

### 1. Build Your First Workflow (Workflow 1: AI Blog Generator)

In n8n UI (http://localhost:5678):

1. Create new workflow
2. Add nodes:
   - **Cron** (trigger: weekly Monday 9am)
   - **HTTP Request** (Ollama API)
   - **GitHub** (create PR)
   - **Manual Approval** (human review gate)

3. Configure Ollama node:
   ```json
   {
     "url": "http://localhost:11434/api/generate",
     "method": "POST",
     "body": {
       "model": "llama3.1:8b",
       "prompt": "Generate 5 blog post ideas for FLUO..."
     }
   }
   ```

4. Test workflow manually
5. Review AI output quality
6. Iterate on prompt
7. Enable workflow when ready

### 2. Test AI Blog Post Generation

```bash
# Test prompt locally first
ollama run llama3.1:8b "Write a 1,500-word blog post about behavioral assurance for OpenTelemetry. Target audience: SREs dealing with microservices incidents."
```

Evaluate:
- Technical accuracy (8/10 minimum)
- Tone (helpful, not salesy)
- Structure (clear sections, code examples)

### 3. Create GitHub PR Workflow

See [PRD-111](../docs/prds/PRD-111-n8n-marketing-automation.md) for complete workflow definitions.

Key principle: **Human approves every PR before merge.**

### 4. Build Social Cross-Posting (Workflow 2)

Trigger: GitHub PR merged → Ollama repurposes → **Manual approval gate** → Post to socials

### 5. Set Up Email Campaigns (Workflow 3)

Pre-approve email templates → Ollama personalizes → SendGrid sends

## Human Approval Gates

**Every public-facing workflow has approval:**

✅ **Blog Posts:** GitHub PR review
✅ **Social Media:** Manual approval in n8n UI
✅ **HackerNews:** Human manually submits
✅ **Case Studies:** Customer + editor approval
✅ **Emails:** Pre-approved templates only

**Internal automation (no approval needed):**
- Analytics reports (Slack/Notion)
- Lead scoring (CRM updates)
- Content drafts (saved for review)

## Monitoring

### Check n8n Execution History
- URL: http://localhost:5678/executions
- Shows: All runs, successes, failures

### Check Ollama Status
```bash
ollama list  # See installed models
ollama ps    # See running models
```

### Test Workflows
Always test manually before enabling cron triggers!

## Troubleshooting

### Ollama Not Starting
```bash
# Check if already running
curl http://localhost:11434/api/version

# If not, start manually
ollama serve
```

### n8n Login Required
```bash
# Set credentials in .env
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your_password
```

### API Rate Limits
- LinkedIn: 100 posts/day (free)
- Twitter: 1,500 posts/month (free)
- SendGrid: 100 emails/day (free)

## Cost Breakdown

| Item | Cost | Notes |
|------|------|-------|
| n8n (self-hosted) | $0 | Node.js package |
| Ollama (local) | $0 | Runs on existing hardware |
| All API free tiers | $0 | PostHog, SendGrid, LinkedIn, etc. |
| **Total** | **$0/month** | |

**Hardware:** 16GB RAM recommended (for llama3.1:8b)

## Learning Resources

- [n8n Docs](https://docs.n8n.io/)
- [Ollama Docs](https://ollama.com/docs)
- [PRD-111: Full Workflow Guide](../docs/prds/PRD-111-n8n-marketing-automation.md)
- [PRD-110: Zero-Budget Strategy](../docs/prds/PRD-110-zero-budget-marketing-strategy.md)

## Time Investment

**Week 1 (Setup):**
- Day 1: Setup + Test Ollama (2 hrs)
- Day 2-3: Build Workflow 1 (Blog Generator) (4 hrs)
- Day 4-5: Build Workflow 2 (Social Cross-Post) (4 hrs)

**Week 2 (Automation):**
- Build Workflows 3-8 (10 hrs)
- Test all workflows
- Enable production automation

**Ongoing:**
- 1 hour/week maintenance
- Review AI-generated content
- Approve social posts
- Monitor analytics

## Success Metrics

**Month 1:**
- ✅ 4 blog posts published (AI-generated, human-reviewed)
- ✅ 20+ social posts (auto-cross-posted)
- ✅ Email drip campaigns active
- ✅ Lead scoring operational

**Month 3:**
- ✅ 12 blog posts
- ✅ 100+ social posts
- ✅ 50 leads nurtured
- ✅ 2-3 case studies

**Time Savings:**
- 9 hrs/week manual → 1 hr/week automated (89% reduction)

## Need Help?

1. Check [README.md](./README.md) for full architecture
2. Read [PRD-111](../docs/prds/PRD-111-n8n-marketing-automation.md) for workflow details
3. Test prompts locally with Ollama before n8n
4. Start with manual triggers, enable cron later

## Let's Build! 🚀

You have everything you need:
- ✅ Marketing infrastructure (n8n + Ollama)
- ✅ Zero-cost stack (all free tiers)
- ✅ Human-in-the-loop safeguards
- ✅ 10 comprehensive PRDs (roadmap ready)

**Start with:** `./scripts/setup.sh` and test your first AI-generated blog post!
