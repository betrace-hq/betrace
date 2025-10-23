# BeTrace MCP Server

**Model Context Protocol server for BeTrace documentation and DSL assistance.**

Enables AI assistants (like Claude) to:
- ✅ Access BeTrace documentation (setup guides, DSL references, AI safety patterns)
- ✅ Create BeTraceDSL rules from natural language descriptions
- ✅ Validate BeTraceDSL syntax and check security limits
- ✅ Provide setup instructions for different environments (local, AWS, GCP, Azure)
- ✅ Troubleshoot common BeTrace issues (KMS, DSL, observability)
- ✅ Search BeTrace documentation by keywords and categories

---

## Quick Start

### 1. Install Dependencies

```bash
cd mcp-server
npm install
```

### 2. Build TypeScript

```bash
npm run build
```

### 3. Configure Claude for Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "fluo": {
      "command": "node",
      "args": [
        "/absolute/path/to/betrace/mcp-server/dist/index.js"
      ]
    }
  }
}
```

**Replace `/absolute/path/to/betrace` with your actual BeTrace project path!**

### 4. Restart Claude for Desktop

Close and reopen Claude for Desktop. The BeTrace MCP server will now be available.

### 5. Test in Claude

Ask Claude:
> "Use the BeTrace MCP server to create a BeTraceDSL rule for detecting PII access without audit logging (compliance use case)"

Or:
> "Show me the AWS KMS setup guide from BeTrace"

---

## Available Tools

### `create_betrace_dsl_rule`

Create BeTraceDSL rules from natural language descriptions.

**Parameters**:
- `description` (string): Natural language description of the rule
- `use_case` (enum): One of: `sre`, `developer`, `compliance`, `ai-safety`, `security`, `performance`, `reliability`

**Example**:
```
Create a BeTraceDSL rule to detect when an AI agent deviates from its original goal (use case: ai-safety)
```

**Output**: Valid BeTraceDSL syntax with explanation and related patterns.

---

### `validate_betrace_dsl`

Validate BeTraceDSL syntax and check security limits (PRD-005).

**Parameters**:
- `dsl_code` (string): BeTraceDSL code to validate

**Example**:
```
Validate this DSL:
trace.has(pii.access) and trace.has(audit.log)
```

**Output**: Validation result with errors, warnings, and security limit checks.

**Security Limits Checked**:
- ✅ DSL size (max 64KB)
- ✅ String literals (max 10KB each)
- ✅ Nesting depth (max 50 levels)

---

### `explain_betrace_setup`

Provide step-by-step setup instructions for BeTrace deployment.

**Parameters**:
- `environment` (enum): One of: `local`, `aws`, `gcp`, `azure`, `kubernetes`
- `use_kms` (boolean, optional): Whether to use cloud KMS

**Example**:
```
Explain how to set up BeTrace on AWS with KMS integration
```

**Output**: Environment-specific setup guide extracted from BeTrace documentation.

---

### `troubleshoot_betrace`

Diagnose common BeTrace issues.

**Parameters**:
- `error_message` (string): Error message or symptom description
- `component` (enum): One of: `kms`, `dsl`, `backend`, `frontend`, `observability`

**Example**:
```
Troubleshoot: "Access Denied" error when calling KMS API
```

**Output**: Diagnostic steps, common causes, and solutions.

---

### `search_betrace_docs`

Search BeTrace documentation by keywords.

**Parameters**:
- `query` (string): Search keywords
- `category` (enum, optional): One of: `setup`, `dsl`, `architecture`, `compliance`, `ai-safety`, `skills`, `all`

**Example**:
```
Search for "agent monitoring" in AI safety documentation
```

**Output**: List of matching documentation resources with URIs.

---

## Available Resources (Documentation)

### Setup Guides
- `fluo://setup/quickstart` - KMS Quickstart (30 minutes)
- `fluo://setup/aws-kms` - AWS KMS Setup Tutorial (45-60 minutes)
- `fluo://setup/troubleshooting` - KMS Troubleshooting Guide (Top 10 issues)

### BeTraceDSL Documentation
- `fluo://dsl/syntax` - Syntax Reference (EBNF grammar)
- `fluo://dsl/patterns` - Pattern Library (50+ templates)
- `fluo://dsl/validation` - Validation Guide (security limits, debugging)
- `fluo://dsl/translation` - Translation Guide (DSL → Drools DRL)

### AI Safety
- `fluo://ai-safety/enterprise` - AI Safety for Enterprise (agent monitoring, hallucination detection, bias detection)
- `fluo://ai-safety/quick-start` - AI Safety Quick Start

### Compliance
- `fluo://compliance/status` - Compliance Status (SOC2, HIPAA)
- `fluo://compliance/integration` - Compliance Integration (@SOC2, @HIPAA annotations)

### Skills (Progressive Disclosure)
- `fluo://skills/architecture` - Architecture patterns, ADR compliance
- `fluo://skills/fluo-dsl` - BeTraceDSL skill
- `fluo://skills/security` - OWASP review, threat models
- `fluo://skills/compliance` - SOC2/HIPAA evidence generation
- `fluo://skills/quality` - Test coverage, edge case detection
- `fluo://skills/implementation` - PRD execution patterns
- `fluo://skills/product` - PRD creation from requirements
- `fluo://skills/java-quarkus` - Quarkus backend patterns
- `fluo://skills/react-tanstack` - React frontend patterns
- `fluo://skills/nix` - Nix flake patterns

---

## Development

### Watch Mode (TypeScript auto-rebuild)

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Clean

```bash
npm run clean
```

---

## How It Works

### Architecture

```
┌─────────────────────┐
│ Claude for Desktop  │
│ (MCP Client)        │
└──────────┬──────────┘
           │ MCP Protocol (STDIO)
           │
┌──────────▼──────────┐
│ BeTrace MCP Server     │
│ (Node.js + TS)      │
├─────────────────────┤
│ Tools:              │
│ - create_dsl_rule   │
│ - validate_dsl      │
│ - explain_setup     │
│ - troubleshoot      │
│ - search_docs       │
├─────────────────────┤
│ Resources:          │
│ - Setup guides      │
│ - DSL docs          │
│ - AI safety         │
│ - Compliance        │
│ - Skills            │
└──────────┬──────────┘
           │ File System Access
           │
┌──────────▼──────────┐
│ BeTrace Project        │
│ - docs/             │
│ - .skills/          │
│ - .subagents/       │
│ - marketing/docs/   │
└─────────────────────┘
```

### Protocol

BeTrace MCP Server implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io) specification:

1. **Transport**: STDIO (Standard Input/Output)
2. **Capabilities**:
   - **Tools**: Functions callable by AI assistants (e.g., `create_betrace_dsl_rule`)
   - **Resources**: Documentation accessible via URI (e.g., `fluo://setup/quickstart`)

### Tool Execution Flow

```
1. User asks Claude: "Create a DSL rule for PII detection"
2. Claude invokes: create_betrace_dsl_rule(description="...", use_case="compliance")
3. MCP Server:
   - Reads .skills/betrace-dsl/pattern-library.md
   - Extracts compliance patterns
   - Generates DSL syntax
   - Returns result to Claude
4. Claude presents result to user
```

### Resource Access Flow

```
1. User asks Claude: "Show me the AWS KMS setup guide"
2. Claude searches: search_betrace_docs(query="AWS KMS", category="setup")
3. Claude reads: fluo://setup/aws-kms
4. MCP Server:
   - Maps URI to docs/setup/AWS_KMS_SETUP.md
   - Reads file from BeTrace project
   - Returns markdown content
5. Claude presents documentation to user
```

---

## Configuration for Different MCP Clients

### Claude for Desktop (macOS)

File: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "fluo": {
      "command": "node",
      "args": [
        "/Users/yourname/Projects/fluo/mcp-server/dist/index.js"
      ]
    }
  }
}
```

### Claude for Desktop (Windows)

File: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "fluo": {
      "command": "node",
      "args": [
        "C:\\Users\\yourname\\Projects\\fluo\\mcp-server\\dist\\index.js"
      ]
    }
  }
}
```

### Other MCP Clients

For custom MCP clients, start the server via STDIO:

```bash
node /path/to/betrace/mcp-server/dist/index.js
```

The server communicates via:
- **STDIN**: Receives MCP requests (JSON-RPC)
- **STDOUT**: Sends MCP responses (JSON-RPC)
- **STDERR**: Logs server events (not part of protocol)

---

## Troubleshooting

### "BeTrace MCP server not showing up in Claude"

1. **Check config file path**:
   ```bash
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. **Verify absolute path**:
   ```bash
   ls -l /path/to/betrace/mcp-server/dist/index.js
   ```

3. **Test server manually**:
   ```bash
   node /path/to/betrace/mcp-server/dist/index.js
   # Should log: [MCP] BeTrace MCP Server started
   ```

4. **Restart Claude for Desktop** (config only loaded on startup)

### "Tool returns empty/error results"

1. **Check BeTrace project structure**:
   ```bash
   ls -l /path/to/betrace/docs/setup/KMS_QUICKSTART.md
   ls -l /path/to/betrace/.skills/betrace-dsl/pattern-library.md
   ```

2. **Verify file permissions**:
   ```bash
   chmod +r /path/to/betrace/docs/**/*.md
   chmod +r /path/to/betrace/.skills/**/*.md
   ```

3. **Check server logs** (stderr output in Claude logs):
   - macOS: `~/Library/Logs/Claude/mcp-server-fluo.log`

### "Node.js not found"

Install Node.js 18+ from [nodejs.org](https://nodejs.org) or via package manager:

```bash
# macOS
brew install node

# Ubuntu/Debian
sudo apt install nodejs npm

# Windows
# Download from nodejs.org
```

---

## Examples

### Example 1: Create PII Detection Rule

**User**:
> Use the BeTrace MCP server to create a BeTraceDSL rule for detecting PII access without audit logging (compliance use case)

**Claude Response**:
```
# BeTraceDSL Rule Generator

**Input**: Detect PII access without audit logging
**Use Case**: compliance

## Recommended Pattern

Based on your use case (compliance), here are the most relevant BeTraceDSL patterns:

[... compliance patterns from pattern library ...]

## Generated DSL

```
// Detect PII access without audit logging
trace.has(database.query).where(data.contains_pii == true)
  and trace.has(audit.log)
```

## Next Steps

1. Copy the DSL above into BeTrace's Rule Editor
2. Test with sample traces using the Rule Testing Interface
3. Validate syntax using the `validate_betrace_dsl` tool
4. Deploy to production when tests pass
```

---

### Example 2: Validate DSL Syntax

**User**:
> Validate this BeTraceDSL:
> trace.has(agent.goal_deviation) > 0.5

**Claude Response**:
```
# BeTraceDSL Validation Result

**Status**: WARNING

## Security Limits
- ✅ DSL size: 45 bytes (limit: 64KB)
- ✅ Max string: 0 bytes (limit: 10KB)
- ✅ Nesting depth: 1 levels (limit: 50)

## Errors
- None

## Warnings
- ⚠️  DSL should contain at least one trace.* function

## Next Steps
1. Review warnings (optional)
2. Test rule with sample traces
3. Deploy

## Related Documentation
- Validation Guide: fluo://dsl/validation
- Syntax Reference: fluo://dsl/syntax
```

---

### Example 3: AWS KMS Setup

**User**:
> How do I set up BeTrace on AWS with KMS integration?

**Claude** (invokes `explain_betrace_setup(environment="aws", use_kms=true)`):
```
# BeTrace Setup: AWS

## AWS KMS Production Setup (15-30 minutes)

### Prerequisites
- AWS account with KMS permissions
- AWS CLI configured (`aws configure`)
- BeTrace backend deployed (EC2, ECS, or Kubernetes)

### Step 1: Create KMS Master Key (5 minutes)
...

[... full AWS KMS setup instructions ...]
```

---

### Example 4: Troubleshoot KMS Error

**User**:
> I'm getting "Access Denied" when BeTrace calls AWS KMS. How do I fix this?

**Claude** (invokes `troubleshoot_betrace(error_message="Access Denied", component="kms")`):
```
# BeTrace Troubleshooting: KMS

**Error**: Access Denied

## Issue 1: "Access Denied" - IAM Permission Error

### Symptom
```
KmsException: User: arn:aws:iam::123456789012:role/fluo-backend is not authorized to perform: kms:GenerateDataKey
```

### Causes
1. IAM policy not attached to role
2. Key policy doesn't grant access to role
3. Encryption context mismatch

### Solution
```bash
# 1. Verify IAM policy is attached
aws iam list-attached-role-policies --role-name fluo-backend

# 2. Verify key policy includes role ARN
aws kms get-key-policy --key-id $KEY_ARN --policy-name default

# 3. Test with AWS CLI
aws kms generate-data-key --key-id $KEY_ARN --key-spec AES_256
```

[... full troubleshooting steps ...]
```

---

### Example 5: Search Documentation

**User**:
> Find BeTrace documentation about AI agent monitoring

**Claude** (invokes `search_betrace_docs(query="agent monitoring", category="ai-safety")`):
```
# BeTrace Documentation Search

**Query**: agent monitoring
**Category**: ai-safety

## Results (2 found)

### AI Safety for Enterprise
- **URI**: `fluo://ai-safety/enterprise`
- **Category**: ai-safety
- **Description**: Agent monitoring, hallucination detection, and bias detection patterns

### AI Safety Quick Start
- **URI**: `fluo://ai-safety/quick-start`
- **Category**: ai-safety
- **Description**: Get started with BeTrace AI safety monitoring in 30 minutes

## How to Access
Use the `ReadResourceRequest` with one of the URIs above to read the full documentation.

Example (Claude for Desktop):
```
Read the resource at fluo://ai-safety/enterprise
```
```

---

## Security

### File Access

BeTrace MCP Server only reads files from the BeTrace project directory. It does NOT:
- ❌ Write files
- ❌ Execute arbitrary commands
- ❌ Access files outside BeTrace project
- ❌ Make network requests

### STDIO Transport

Communication via STDIO (Standard Input/Output) is local-only. No network exposure.

### Security Limits Enforced

All `validate_betrace_dsl` calls enforce PRD-005 security limits:
- Max DSL size: 64KB (prevents DoS)
- Max string literals: 10KB (prevents memory exhaustion)
- Max nesting depth: 50 levels (prevents stack overflow)

---

## Roadmap

### Planned Features (Q1 2026)
- [ ] Support for GCP KMS, Azure Key Vault setup guides
- [ ] Interactive DSL debugger (step-through rule execution)
- [ ] Compliance evidence export via MCP tool
- [ ] Integration with BeTrace Rule Testing API (test DSL directly from Claude)
- [ ] Context-aware DSL suggestions (analyze existing rules, suggest improvements)

### Future Enhancements
- [ ] Multi-language support (Python, Java bindings)
- [ ] HTTP/SSE transport (for remote MCP clients)
- [ ] Real-time rule performance metrics (cache hit rate, execution time)

---

## References

- **Model Context Protocol**: https://modelcontextprotocol.io
- **BeTrace Documentation**: https://docs.betrace.dev
- **Claude for Desktop**: https://claude.ai/download

---

**Version**: 1.0.0
**Last Updated**: 2025-10-22
**Maintained By**: BeTrace Platform Team
