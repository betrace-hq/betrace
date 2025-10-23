# PRD-111: n8n Marketing Automation Workflows

**Status:** DRAFT
**Priority:** P0 (Replaces Manual Marketing Effort)
**Created:** 2025-10-12
**Estimated Effort:** 1 week setup + ongoing workflow creation
**Budget:** $0 (n8n self-hosted + Ollama local)

## Context

**Constraint:** Near-zero budget + need to scale marketing without hiring.

**Solution:** n8n (self-hosted workflow automation) + Ollama (local LLM) for:
- AI-generated content (blog posts, social media)
- Automated drip campaigns (email nurture sequences)
- Social media scheduling (LinkedIn, Twitter, HackerNews)
- Lead scoring & routing (PostHog → n8n → CRM)
- Case study generation (interview → AI → draft)

**Key Advantage:** n8n is open source, self-hosted, and has 400+ integrations.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                    n8n Server                    │
│            (Self-Hosted on BeTrace infra)           │
└─────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌─────────────┐ ┌──────────────┐
│   Ollama     │ │  PostHog    │ │   GitHub     │
│  (Local LLM) │ │ (Analytics) │ │ (Blog Repo)  │
└──────────────┘ └─────────────┘ └──────────────┘
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌─────────────┐ ┌──────────────┐
│Social Media  │ │    Email    │ │     CRM      │
│(LinkedIn API)│ │ (SendGrid)  │ │  (Notion)    │
└──────────────┘ └─────────────┘ └──────────────┘
```

---

## n8n Workflow Catalog

### Workflow 1: AI Blog Post Generator

**Trigger:** Weekly cron (every Monday 9am)

**Steps:**
1. **Generate Topic Ideas** (Ollama)
   - Prompt: "Generate 5 blog post ideas for BeTrace (behavioral assurance for OpenTelemetry). Target: SREs. SEO focus: 'opentelemetry [keyword]'"
   - Model: `llama3.1:8b` or `mistral:7b`
   - Output: 5 topics with keywords

2. **Select Topic** (JavaScript function)
   - Pick first topic from list
   - Store in n8n variable

3. **Generate Blog Post** (Ollama)
   - Prompt: Full blog post template (from PRD-110)
   - Input: Selected topic
   - Output: 1,500-word markdown blog post

4. **Generate Meta Description** (Ollama)
   - Prompt: "Write 150-char meta description for this blog post"
   - Output: SEO-optimized description

5. **Create GitHub PR** (GitHub API)
   - Create new file: `blog/posts/YYYY-MM-DD-title.md`
   - Commit message: "feat(blog): add post on [topic]"
   - Create PR for review

6. **Notify on Slack** (Slack webhook)
   - Message: "New blog post draft ready for review: [PR link]"

**Result:** Weekly blog post drafted automatically, human reviews & merges PR.

---

### Workflow 2: Social Media Cross-Posting

**Trigger:** GitHub webhook (when blog post PR merged to main)

**Steps:**
1. **Fetch Blog Post** (HTTP Request)
   - GET blog post markdown from GitHub
   - Parse frontmatter (title, meta description)

2. **Generate LinkedIn Post** (Ollama)
   - Prompt: "Repurpose this blog post as 200-word LinkedIn post. Professional tone. Include key takeaway."
   - Input: Blog post content
   - Output: LinkedIn-ready text

3. **Post to LinkedIn** (LinkedIn API)
   - API endpoint: `/ugcPosts`
   - Include: Text + blog post link + BeTrace logo image
   - Schedule: Immediate

4. **Generate Twitter Thread** (Ollama)
   - Prompt: "Turn this blog into 8-tweet thread. Technical but accessible. Include code snippet if relevant."
   - Output: Array of 8 tweets

5. **Post Twitter Thread** (Twitter API v2)
   - Loop through tweets
   - Post sequentially (reply to previous tweet)
   - Include blog link in final tweet

6. **Submit to HackerNews** (HackerNews API)
   - Check if post is technical enough (Ollama classification)
   - If yes: Submit via HN API
   - If no: Skip

7. **Track Analytics** (PostHog event)
   - Event: `blog_post_published`
   - Properties: title, topic, social_channels

**Result:** Blog post automatically promoted across all social channels within 5 minutes of publish.

---

### Workflow 3: Email Drip Campaign (MQL Nurture)

**Trigger:** PostHog webhook (when `newsletter_signup` event fires)

**Steps:**
1. **Extract Lead Data** (Webhook payload)
   - Email, source page, signup date
   - Store in n8n database (PostgreSQL)

2. **Lead Enrichment** (Clearbit API free tier)
   - Lookup company name, size, industry
   - Store enriched data

3. **Day 0: Welcome Email**
   - Template: "Welcome to BeTrace + here's our best content"
   - Include: Link to "What is Behavioral Assurance?" post
   - Send via SendGrid API (free tier: 100/day)

4. **Wait 3 Days** (n8n delay node)

5. **Day 3: Educational Content**
   - Check: Which blog posts has user read? (PostHog query)
   - Generate personalized email (Ollama)
     - Prompt: "Write email recommending [unread posts]. Helpful tone, not salesy."
   - Send via SendGrid

6. **Wait 4 Days** (n8n delay node)

7. **Day 7: Use Case Highlight**
   - Email: "How [Company] reduced MTTR by 60% with BeTrace"
   - Link to case study (PRD-106)
   - CTA: "Try Interactive Demo"

8. **Wait 7 Days** (n8n delay node)

9. **Day 14: Trial Offer**
   - Check: Has user clicked demo link? (PostHog query)
   - If yes: "Ready to try BeTrace with your data?"
   - If no: "Still exploring? Here's a quick demo video"
   - CTA: "Request Trial Access"

10. **Lead Scoring** (JavaScript function)
    - Calculate score based on:
      - Email opens (5 points each)
      - Link clicks (10 points each)
      - Demo viewed (20 points)
      - Trial requested (50 points)
    - If score >40: Create task in Notion (CRM)

**Result:** Automated 14-day nurture sequence, personalized based on user behavior.

---

### Workflow 4: Case Study Generation Pipeline

**Trigger:** Manual (when customer interview scheduled)

**Steps:**
1. **Pre-Interview Setup**
   - Create Notion page for case study
   - Generate interview questions (Ollama)
     - Prompt: "Create 10 interview questions for SRE at [Company]. Focus: problem before BeTrace, implementation, quantified results."
   - Send to customer via email (SendGrid)

2. **Post-Interview Processing**
   - Manual trigger after Zoom call
   - Input: Otter.ai transcript URL

3. **Fetch Transcript** (HTTP Request)
   - GET transcript from Otter.ai API
   - Clean up formatting

4. **Extract Key Metrics** (Ollama)
   - Prompt: "Extract quantified outcomes from this transcript: MTTR reduction %, incident frequency, hours saved, etc."
   - Output: Structured JSON with metrics

5. **Generate Case Study Draft** (Ollama)
   - Prompt: Full case study template (from PRD-106)
   - Input: Transcript + extracted metrics
   - Output: 1,200-word case study markdown

6. **Create GitHub PR** (GitHub API)
   - New file: `blog/case-studies/company-name.md`
   - Include: Draft + metrics + TODO for customer review

7. **Send for Customer Review** (SendGrid)
   - Email: "Here's your draft case study. Please review and approve."
   - Link to GitHub PR (rendered preview)

8. **Wait for Approval** (n8n manual approval node)
   - Customer comments on PR or replies to email
   - Human approves in n8n UI

9. **Publish Case Study**
   - Merge PR
   - Trigger Workflow 2 (social media cross-posting)
   - Add customer to CRM as "advocate"

**Result:** Case study created in 2 hours (vs 8 hours manual), fully automated pipeline.

---

### Workflow 5: Lead Scoring & Routing

**Trigger:** PostHog webhook (any analytics event)

**Steps:**
1. **Event Classification** (JavaScript function)
   - Map event to points:
     - `blog_post_viewed`: +5
     - `demo_started`: +20
     - `demo_completed`: +30
     - `trial_requested`: +50
     - `docs_viewed`: +10

2. **Update Lead Score** (PostgreSQL)
   - Query: `UPDATE leads SET score = score + [points] WHERE email = [user_email]`

3. **Check Qualification Threshold** (IF node)
   - If score ≥ 50: Product-Qualified Lead (PQL)
   - If score ≥ 40: Sales-Qualified Lead (SQL)
   - If score ≥ 20: Marketing-Qualified Lead (MQL)

4. **Route to CRM** (Notion API)
   - Create task in appropriate Notion board:
     - PQL → "Trial Onboarding" board
     - SQL → "Sales Follow-Up" board
     - MQL → "Nurture Campaign" board

5. **Send Slack Notification** (Slack webhook)
   - Message: "New PQL: [email] (score: [score], last action: [event])"
   - Channel: `#leads`

6. **Trigger Appropriate Workflow**
   - If PQL: Send trial access credentials (Workflow 6)
   - If SQL: Notify sales rep (email)
   - If MQL: Continue nurture campaign (Workflow 3)

**Result:** Real-time lead scoring and routing, no manual tracking needed.

---

### Workflow 6: Trial Access Automation

**Trigger:** Manual n8n trigger (when PQL requests trial)

**Steps:**
1. **Generate Trial Environment** (Bash command via n8n)
   - Run: `nix run .#create-trial-env --email=[email]`
   - Output: Trial URL, credentials

2. **Send Welcome Email** (SendGrid)
   - Template: "Your BeTrace trial is ready!"
   - Include: Login credentials, getting started guide
   - CTA: "Start exploring BeTrace"

3. **Create Onboarding Sequence**
   - Day 0: Welcome email (sent in Step 2)
   - Day 1: "Getting started with your first rule"
   - Day 3: "Rule library examples you can copy-paste"
   - Day 7: "Halfway through your trial - need help?"
   - Day 14: "Trial expiring soon - let's chat"

4. **Track Trial Usage** (PostHog query)
   - Daily check: Has user logged in? Created rules?
   - If inactive for 3 days: Send nudge email

5. **Notify Sales on Trial Expiry** (Slack)
   - Day 14: Alert sales rep to follow up
   - Include: Trial usage stats (rules created, signals generated)

**Result:** Fully automated trial provisioning and onboarding.

---

### Workflow 7: HackerNews Auto-Submission

**Trigger:** GitHub webhook (blog post published)

**Steps:**
1. **Analyze Post Quality** (Ollama)
   - Prompt: "Is this blog post suitable for HackerNews? Criteria: technical depth, not promotional, novel insights. Answer yes/no and explain."
   - Input: Blog post content
   - Output: yes/no + reasoning

2. **IF: Post is HN-worthy** (IF node)
   - If yes: Continue to next step
   - If no: Skip submission, log reason

3. **Generate HN Title** (Ollama)
   - Prompt: "Write HackerNews submission title. Max 80 chars. Technical but intriguing. Avoid clickbait."
   - Output: Optimized title

4. **Generate First Comment** (Ollama)
   - Prompt: "Write HN first comment from author. Explain: context, why this matters, technical deep dive. Avoid promotional tone."
   - Output: Comment text

5. **Submit to HackerNews** (HN API)
   - POST to `/submit`
   - Title: [generated title]
   - URL: Blog post URL

6. **Post First Comment** (HN API)
   - Wait 30 seconds
   - POST comment to submission

7. **Track Submission** (Notion)
   - Create entry: HN submission ID, URL, timestamp
   - Monitor: Check HN API every hour for upvotes, comments

8. **Alert on Front Page** (Slack)
   - If upvotes > 50: "We're on HN front page! [link]"

**Result:** Automated HN submissions, optimized for engagement.

---

### Workflow 8: Weekly Analytics Report

**Trigger:** Cron (every Monday 9am)

**Steps:**
1. **Fetch PostHog Data** (PostHog API)
   - Last 7 days metrics:
     - Page views, unique visitors
     - Top blog posts
     - Conversion events (demo, trial, newsletter)

2. **Fetch Social Media Stats** (APIs)
   - LinkedIn: Impressions, engagement, followers gained
   - Twitter: Impressions, retweets, followers gained
   - HackerNews: Upvotes, comments

3. **Calculate Lead Metrics** (PostgreSQL query)
   - New leads: MQL, SQL, PQL
   - Lead score distribution
   - Conversion rates (MQL→SQL→PQL)

4. **Generate Report Summary** (Ollama)
   - Prompt: "Summarize this weekly marketing data. Highlight wins, identify areas to improve. 200 words."
   - Input: All metrics
   - Output: Executive summary

5. **Create Notion Report Page** (Notion API)
   - Title: "Weekly Marketing Report - [Date]"
   - Sections: Traffic, Leads, Social, Top Content, Summary

6. **Send Slack Summary** (Slack)
   - Message: Week-over-week changes, top performers
   - Link to full Notion report

**Result:** Automated weekly reporting, no manual data compilation.

---

## n8n Setup Guide

### Installation (Self-Hosted)

```bash
# Option 1: Docker (Recommended)
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n

# Option 2: Nix (BeTrace-style)
# Add to flake.nix
packages.n8n = pkgs.n8n;

nix run .#n8n
```

**Access:** http://localhost:5678

---

### Ollama Setup (Local LLM)

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull models
ollama pull llama3.1:8b    # Good for content generation
ollama pull mistral:7b     # Faster, good for short tasks
ollama pull codellama:7b   # Good for code examples

# Run Ollama server
ollama serve
# API available at http://localhost:11434
```

**n8n Ollama Integration:**
- Use HTTP Request node
- POST to `http://localhost:11434/api/generate`
- Body: `{ "model": "llama3.1:8b", "prompt": "[your prompt]" }`

---

### Required n8n Integrations (Free)

**Built-in Nodes:**
- ✅ HTTP Request (for Ollama, APIs)
- ✅ PostgreSQL (lead database)
- ✅ GitHub (blog repo management)
- ✅ Slack (notifications)
- ✅ Cron (scheduled workflows)
- ✅ JavaScript (custom logic)

**External APIs (Free Tiers):**
- ✅ PostHog (analytics) - Free: 1M events/month
- ✅ SendGrid (email) - Free: 100 emails/day
- ✅ LinkedIn API (social posting) - Free: 100 posts/day
- ✅ Twitter API v2 (Basic) - Free: 1,500 posts/month
- ✅ Notion API (CRM) - Free: unlimited pages
- ✅ HackerNews API - Free: unlimited

**Total Cost:** $0 (all free tiers)

---

## Workflow Templates (Export/Import)

### Template 1: AI Blog Post Generator

```json
{
  "name": "AI Blog Post Generator",
  "nodes": [
    {
      "parameters": {
        "rule": "0 9 * * 1"
      },
      "name": "Weekly Trigger",
      "type": "n8n-nodes-base.cron"
    },
    {
      "parameters": {
        "url": "http://localhost:11434/api/generate",
        "method": "POST",
        "body": {
          "model": "llama3.1:8b",
          "prompt": "Generate 5 blog post ideas for BeTrace..."
        }
      },
      "name": "Ollama: Generate Topics",
      "type": "n8n-nodes-base.httpRequest"
    },
    {
      "parameters": {
        "functionCode": "return items.map(item => ({ json: { topic: item.json.response.split('\\n')[0] } }))"
      },
      "name": "Select First Topic",
      "type": "n8n-nodes-base.function"
    }
  ]
}
```

**Import:** n8n UI → Workflows → Import from JSON

---

## Cost Comparison: n8n vs Manual

### Manual Effort (PRD-110)
- Content creation: 2 hrs/week
- Social media: 3 hrs/week
- Email campaigns: 2 hrs/week
- Lead tracking: 2 hrs/week
- **Total: 9 hrs/week = $900/week @ $100/hr**

### n8n Automation
- Setup time: 40 hours (one-time)
- Maintenance: 1 hr/week (monitor workflows)
- **Total: 1 hr/week = $100/week @ $100/hr**

**Savings:** $800/week = $41,600/year

**ROI:** 1040x (payback after 6 weeks)

---

## Ollama Model Recommendations

### Blog Posts (1,500+ words)
- **llama3.1:8b** - Best quality, 2-3 min generation
- **mistral:7b** - Faster, good quality, 1-2 min

### Social Media (200 words)
- **mistral:7b** - Fast, conversational tone
- **llama3.1:8b** - If need higher quality

### Code Examples (BeTrace DSL)
- **codellama:7b** - Specialized for code
- **llama3.1:8b** - Good for DSL syntax

### Email Copy (100-200 words)
- **mistral:7b** - Fast, professional tone
- **llama3.1:8b** - If personalization needed

**Hardware Requirements:**
- 8GB RAM: mistral:7b (recommended)
- 16GB RAM: llama3.1:8b (better quality)
- 32GB RAM: llama3.1:70b (best quality, slower)

---

## Testing Strategy

### Workflow Testing
1. **Dry Run Mode:** Enable n8n "Test Workflow" (doesn't execute)
2. **Staging Environment:** Test workflows on separate n8n instance
3. **Manual Triggers:** Override cron triggers for testing
4. **Output Validation:** Check Ollama outputs for quality

### Ollama Prompt Testing
```bash
# Test prompt locally before adding to n8n
ollama run llama3.1:8b "Generate 5 blog post ideas for BeTrace..."

# Iterate on prompt until output quality is good
```

### A/B Testing (n8n Switch Node)
```
IF random() < 0.5:
  → Email Template A
ELSE:
  → Email Template B

Track conversion rates in PostHog
```

---

## Monitoring & Maintenance

### n8n Monitoring Dashboard
- Workflow execution history (built-in)
- Failed workflow alerts (Slack)
- Execution time tracking (optimize slow workflows)

### Weekly Maintenance Tasks
1. Review failed workflows (if any)
2. Check Ollama output quality (random sample)
3. Update prompts based on performance
4. Add new workflows as needed

---

## Implementation Plan

### Week 1: Setup
**Day 1-2:**
- Install n8n (Docker or Nix)
- Install Ollama + pull models
- Set up PostgreSQL lead database

**Day 3-4:**
- Create Workflow 1 (AI Blog Post Generator)
- Test with Ollama locally
- Integrate with GitHub

**Day 5:**
- Create Workflow 2 (Social Media Cross-Posting)
- Test LinkedIn, Twitter APIs
- Validate output quality

### Week 2: Automation
**Day 1-2:**
- Create Workflow 3 (Email Drip Campaign)
- Set up SendGrid integration
- Test with sample email

**Day 3:**
- Create Workflow 5 (Lead Scoring)
- Integrate PostHog webhooks
- Test scoring logic

**Day 4:**
- Create Workflow 4 (Case Study Pipeline)
- Test with sample transcript

**Day 5:**
- Create Workflows 6-8 (Trial, HN, Analytics)
- Final testing

### Week 3+: Production
- Enable all workflows
- Monitor daily for first week
- Iterate on prompts based on output quality
- Add new workflows as needed

---

## Success Metrics

### Automation Goals (3 Months)
- ✅ 12 blog posts published (AI-generated, human-reviewed)
- ✅ 100+ social media posts (auto-cross-posted)
- ✅ 50 leads nurtured via drip campaigns
- ✅ 5 case studies generated (AI-assisted)
- ✅ 90% time savings (9 hrs/week → 1 hr/week)

### Quality Benchmarks
- ✅ Blog post quality: 8/10 (human review score)
- ✅ Social media engagement: >5% (same as manual)
- ✅ Email open rate: >40% (industry average)
- ✅ Lead scoring accuracy: >80% (matches manual assessment)

---

## Risks & Mitigations

### Risk: Ollama output quality is poor
**Mitigation:**
- Human review loop for blog posts (GitHub PR)
- A/B test prompts, iterate on quality
- Use larger models (llama3.1:70b) if needed

### Risk: n8n workflows break (API changes)
**Mitigation:**
- Set up failure alerts (Slack)
- Version control n8n workflows (export JSON to Git)
- Fallback to manual posting if critical

### Risk: Social media API rate limits
**Mitigation:**
- Respect rate limits (LinkedIn: 100/day, Twitter: 1500/month)
- Queue posts if limit reached
- Spread posting across day (not bursts)

### Risk: Lead scoring inaccuracy
**Mitigation:**
- Start with conservative thresholds
- Review PQLs weekly, adjust scoring logic
- Add human override in n8n

---

## Open Questions

1. **Should all blog posts be AI-generated or mix with manual?**
   - **Recommendation:** 80% AI (reviewed), 20% manual (deep dives)

2. **How to handle Ollama downtime (local server)?**
   - **Recommendation:** Fallback to OpenAI API (pay-per-use for critical workflows)

3. **Should n8n workflows be open-sourced?**
   - **Recommendation:** Yes, share templates (build in public, PRD-110)

4. **What if LinkedIn/Twitter ban automated posting?**
   - **Recommendation:** Use "review + approve" step (human clicks "Post" in n8n)

---

## Success Criteria

- ✅ n8n operational with 8 core workflows
- ✅ Ollama generates 90% of marketing content
- ✅ Time savings: 9 hrs/week → 1 hr/week
- ✅ Content quality: 8/10 average (human review)
- ✅ Lead nurture: 50 MQLs automated in 3 months
- ✅ Cost: $0/month (self-hosted + Ollama local)

---

## References

- [n8n Documentation](https://docs.n8n.io/)
- [Ollama Documentation](https://ollama.com/docs)
- [PostHog Webhooks](https://posthog.com/docs/webhooks)
- PRD-110: Zero-Budget Marketing Strategy
- PRD-109: Content Marketing Engine (now automated)

---

**Key Insight:** n8n + Ollama = **$41K/year savings** with **better consistency** than manual posting.
