# n8n Setup Guide

**Status:** n8n running on http://localhost:5678
**Current Step:** Initial owner account setup required

---

## Quick Setup (5 minutes)

### 1. Complete n8n Initial Setup
1. Open http://localhost:5678 in browser
2. Create owner account:
   - Email: your-email@example.com
   - Password: (choose secure password)
   - Workspace name: FLUO Marketing
3. Click "Get Started"

### 2. Import Workflow 1 via API

Once setup is complete, use the n8n API to import workflows:

```bash
# Get API token from n8n UI: Settings → API → Generate New Token
export N8N_API_TOKEN="your-api-token-here"

# Import Workflow 1
curl -X POST http://localhost:5678/api/v1/workflows \
  -H "Content-Type: application/json" \
  -H "X-N8N-API-KEY: $N8N_API_TOKEN" \
  -d @workflows/01-ai-blog-generator.json
```

**Or manually:**
1. Click "+" (Add Workflow)
2. Click "⋯" menu → Import from File
3. Select `workflows/01-ai-blog-generator.json`

### 3. Configure GitHub Credentials

1. In n8n: Settings → Credentials → Add Credential
2. Select "GitHub API"
3. Authentication: "Access Token"
4. Access Token: [Generate at https://github.com/settings/tokens]
   - Scopes needed: `repo`, `workflow`
5. Save as "GitHub API"

### 4. Set Environment Variables

Create `.env` file in `marketing/` directory:

```bash
# Copy from template
cp .env.example .env

# Edit with your values
GITHUB_REPO=fluohq/fluo  # or your fork
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 5. Test Workflow

1. Open "01 - AI Blog Post Generator" workflow
2. Click "Execute Workflow" button
3. Watch nodes execute in real-time
4. Check GitHub for new PR with blog draft
5. Review quality (targeting 8/10)

---

## API Authentication

n8n requires authentication for API access:

### Option 1: API Key (Recommended)
```bash
# Generate in n8n UI: Settings → API → Generate New Token
export N8N_API_TOKEN="n8n_api_xxxxxxxxxxxxx"

# Use in requests
curl -H "X-N8N-API-KEY: $N8N_API_TOKEN" http://localhost:5678/api/v1/workflows
```

### Option 2: Session Cookie
```bash
# Login via API
curl -X POST http://localhost:5678/rest/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","password":"your-password"}' \
  -c cookies.txt

# Use cookie in subsequent requests
curl -b cookies.txt http://localhost:5678/api/v1/workflows
```

---

## Troubleshooting

### n8n Not Accessible
```bash
# Check if running
ps aux | grep n8n

# Check logs
cd marketing && npm run dev
# Look for: "n8n ready on ::, port 5678"
```

### Workflow Import Fails
- **401 Unauthorized**: Complete initial setup first (http://localhost:5678)
- **Failed to parse**: Check JSON syntax in workflow file
- **Missing credentials**: Configure GitHub API in n8n UI

### Ollama Errors
```bash
# Check Ollama is running
ollama list

# Test Ollama API
curl http://localhost:11434/api/generate \
  -d '{"model":"llama3.1:8b","prompt":"test","stream":false}'
```

---

## Next Steps After Setup

1. ✅ Complete owner setup
2. ✅ Import Workflow 1
3. ✅ Configure GitHub credentials
4. ✅ Set environment variables
5. ✅ Test workflow execution
6. 📝 Review AI-generated blog post
7. 🚀 Iterate on prompts for quality

---

## Security Notes

- **Never commit** `.env` file (contains API keys)
- **Never commit** `.n8n/` directory (contains credentials)
- **Use GitHub tokens** with minimal scopes (only `repo`)
- **Rotate tokens** if accidentally exposed
- **n8n API tokens** are stored in database, not filesystem

---

## Resources

- n8n Docs: https://docs.n8n.io/
- n8n API: https://docs.n8n.io/api/
- Workflow Templates: `./workflows/`
- Model Recommendations: `./docs/MODEL_RECOMMENDATIONS.md`
