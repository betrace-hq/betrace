# FLUO Marketing Automation with Temporal

**Status:** ✅ Fully implemented and ready to test
**Architecture:** Temporal (headless orchestration) + Ollama (AI) + GitHub (publishing) + Slack (notifications)

---

## Quick Start (3 minutes)

### 1. Configure Environment

```bash
cd marketing
cp .env.example .env
# Edit .env and add your GITHUB_TOKEN
```

**Required:**
- `GITHUB_TOKEN`: Generate at https://github.com/settings/tokens (scopes: `repo`)
- `GITHUB_REPO`: Your repository (e.g., `fluohq/fluo`)

**Optional:**
- `SLACK_WEBHOOK_URL`: For team notifications (skips silently if not set)

### 2. Start Temporal Server + Worker

```bash
# Terminal 1: Start Temporal server (includes UI at localhost:8233)
npm run temporal:server

# Terminal 2: Start worker (processes workflows)
npm run temporal:worker
```

### 3. Generate First Blog Post

```bash
# Terminal 3: Trigger workflow
npm run temporal:start-workflow
```

**What happens:**
1. Ollama generates 5 blog topics (llama3.1:8b)
2. Selects first topic and generates 1,500-word blog post
3. Creates GitHub branch + commits file
4. Creates Pull Request (HUMAN APPROVAL GATE)
5. Sends Slack notification
6. **Workflow pauses** waiting for your approval

---

## Human Approval (2 options)

### Option A: Merge PR Manually (Recommended)
1. Go to GitHub PR link (shown in logs/Slack)
2. Review AI-generated blog post
3. Make edits if needed directly in PR
4. Merge PR when ready
5. Workflow detects merge and completes

### Option B: Send Temporal Signal
```bash
# Get workflow ID from logs
temporal workflow signal \
  --workflow-id blog-post-1234567890 \
  --name prApproved \
  --input '123'
```

---

## Temporal UI (Monitoring)

**Access:** http://localhost:8233

**Features:**
- View all workflow executions
- See real-time workflow progress
- Inspect activity logs and errors
- Replay failed workflows
- Send signals for approval

**Navigation:**
1. Open http://localhost:8233
2. Click "Workflows" → Find your workflow ID
3. View execution history, pending activities, signals

---

## Workflow Details

### AI Blog Post Generator Workflow
**File:** `src/workflows/blog-generator.ts`
**Task Queue:** `marketing-automation`
**Duration:** 5-10 minutes (AI generation) + ∞ (waiting for approval)

**Steps:**
1. **Generate Topics** (1 min) - Ollama creates 5 blog ideas
2. **Generate Post** (3-5 min) - Ollama writes 1,500-word article
3. **Create Branch** (10 sec) - GitHub branch + file commit
4. **Create PR** (5 sec) - Opens PR with review checklist
5. **Notify Slack** (2 sec) - Team notification
6. **Wait for Approval** (∞) - Workflow pauses (durable execution)
7. **Notify Published** (2 sec) - Success notification

### Activities (Reusable Tasks)

**Ollama Activities** (`src/activities/ollama.ts`)
- `generateTopics(model, count)` - Generate N blog ideas
- `generateBlogPost(model, topic, wordCount)` - Write full post

**GitHub Activities** (`src/activities/github.ts`)
- `createGitHubBranch(branchName, filePath, content)` - Create branch + file
- `createGitHubPR(title, body, branch)` - Open pull request
- `checkPRMerged(prNumber)` - Poll for PR merge status

**Slack Activities** (`src/activities/slack.ts`)
- `notifySlack(text, prUrl, status)` - Send team notification

---

## Commands Cheat Sheet

### Start Services
```bash
npm run temporal:server    # Start Temporal server (port 7233, UI on 8233)
npm run temporal:worker     # Start workflow worker
npm run dev                 # Start both server + worker
```

### Trigger Workflows
```bash
npm run temporal:start-workflow              # Start and exit
npm run temporal:start-workflow -- --wait    # Start and wait for completion
```

### Monitor Workflows
```bash
# List all workflows
temporal workflow list

# Describe specific workflow
temporal workflow describe --workflow-id blog-post-1234567890

# Show workflow history
temporal workflow show --workflow-id blog-post-1234567890

# Watch workflow in real-time
temporal workflow show --workflow-id blog-post-1234567890 --follow
```

### Approve Blog Posts
```bash
# Send approval signal
temporal workflow signal \
  --workflow-id blog-post-1234567890 \
  --name prApproved \
  --input '"<pr-number>"'

# Or just merge PR on GitHub (workflow detects this)
```

### Debug & Troubleshooting
```bash
# Check worker logs
npm run temporal:worker  # Watch terminal output

# Check activity failures
temporal workflow describe --workflow-id <id>

# Replay failed workflow
temporal workflow reset --workflow-id <id>
```

---

## Scheduling (Cron)

### Option A: Temporal Cron (Recommended)
Edit `src/start-workflow.ts`:
```typescript
const handle = await client.workflow.start(generateWeeklyBlogPost, {
  taskQueue: 'marketing-automation',
  workflowId: 'weekly-blog-post',
  cronSchedule: '0 9 * * 1', // Monday 9am
});
```

### Option B: System Cron
```bash
# Add to crontab
0 9 * * 1 cd /Users/sscoble/Projects/fluo/marketing && npm run temporal:start-workflow
```

---

## Testing Locally

### Test Ollama Integration
```bash
# Test topic generation
ollama run llama3.1:8b "Generate 5 blog post ideas for FLUO (behavioral assurance for OpenTelemetry)"

# Test blog post generation
ollama run llama3.1:8b "Write a 500-word technical blog post about OpenTelemetry trace patterns for SREs"
```

### Test Activities (Unit Tests)
```typescript
// Coming soon: @temporalio/testing integration
import { TestWorkflowEnvironment } from '@temporalio/testing';

test('generateTopics returns 5 topics', async () => {
  const result = await activities.generateTopics({ model: 'llama3.1:8b', count: 5 });
  expect(result).toHaveLength(5);
});
```

---

## Architecture Benefits

### vs n8n
✅ **Truly headless** - No UI setup, pure code
✅ **Version controlled** - All workflows in Git
✅ **Human-in-the-loop** - Built-in signal handling
✅ **Durable execution** - Workflows survive restarts
✅ **Testable** - Unit test workflows and activities
✅ **Fast setup** - 15 minutes vs hours

### Temporal Features
- **Automatic retries** - Activities retry on failure (max 3 attempts)
- **State management** - Workflow state persists across restarts
- **Long-running workflows** - Can run for days/weeks
- **Observability** - Full execution history in UI
- **Replay** - Replay failed workflows from any point

---

## File Structure

```
marketing/
├── src/
│   ├── types.ts                     # Shared TypeScript types
│   ├── workflows/
│   │   └── blog-generator.ts        # Main AI blog workflow
│   ├── activities/
│   │   ├── ollama.ts                # AI generation activities
│   │   ├── github.ts                # PR creation activities
│   │   ├── slack.ts                 # Notification activities
│   │   └── index.ts                 # Activity exports
│   ├── worker.ts                    # Temporal worker
│   └── start-workflow.ts            # CLI workflow starter
├── package.json                     # Dependencies + scripts
├── tsconfig.json                    # TypeScript configuration
├── .env                             # Environment variables (gitignored)
└── .env.example                     # Template
```

---

## Troubleshooting

### Worker Fails to Connect
```
Error: connect ECONNREFUSED 127.0.0.1:7233
```
**Solution:** Start Temporal server first: `npm run temporal:server`

### Activity Timeout
```
Activity startToCloseTimeout exceeded
```
**Solution:** Ollama taking too long. Increase timeout in `blog-generator.ts`:
```typescript
const { generateBlogPost } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes', // Increase from 5 to 10
});
```

### GitHub Authentication Failed
```
HttpError: Bad credentials
```
**Solution:** Check `GITHUB_TOKEN` in `.env` is valid and has `repo` scope.

### Ollama Connection Refused
```
Error: Ollama API error: ECONNREFUSED
```
**Solution:** Start Ollama: `ollama serve` (or check `OLLAMA_API_URL` in `.env`)

### Workflow Stuck Waiting
```
⏸️  Step 6: Waiting for human approval...
```
**Expected:** Workflow is paused waiting for PR merge or signal. Review PR and merge to continue.

---

## Next Steps

1. ✅ **Test first workflow** - Run `npm run temporal:start-workflow`
2. 📝 **Review generated blog post** - Check GitHub PR quality
3. ✅ **Approve and publish** - Merge PR to complete workflow
4. 🔁 **Add cron schedule** - Automate weekly blog generation
5. 📊 **Monitor in Temporal UI** - Track workflow history

---

## Resources

- **Temporal Docs:** https://docs.temporal.io/
- **Temporal TypeScript SDK:** https://typescript.temporal.io/
- **Ollama API:** https://ollama.com/docs/api
- **GitHub REST API:** https://docs.github.com/en/rest
- **Slack Webhooks:** https://api.slack.com/messaging/webhooks

---

## Support

**Issues:**
- Temporal not connecting: Check `npm run temporal:server` is running
- Ollama errors: Check `ollama list` shows llama3.1:8b installed
- GitHub errors: Verify token has `repo` scope
- Workflow stuck: Check worker logs for activity failures

**Logs:**
- Temporal Server: Terminal running `npm run temporal:server`
- Worker: Terminal running `npm run temporal:worker`
- Temporal UI: http://localhost:8233 → Workflows → Your workflow ID
