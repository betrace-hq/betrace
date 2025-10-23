#!/usr/bin/env node

/**
 * FLUO MCP Server
 * 
 * Model Context Protocol server providing AI assistants access to FLUO documentation
 * Uses Streamable HTTP transport for remote deployment
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FLUO_ROOT = path.resolve(__dirname, '../../..');
const PORT = parseInt(process.env.MCP_PORT || '12016');

interface DocResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  category: string;
}

// Documentation index
const resources: DocResource[] = [
  // Setup guides
  { uri: 'fluo://setup/quickstart', name: 'KMS Quickstart', description: '30-min AWS KMS setup', mimeType: 'text/markdown', category: 'setup' },
  { uri: 'fluo://setup/aws-kms', name: 'AWS KMS Setup', description: 'Detailed AWS KMS tutorial', mimeType: 'text/markdown', category: 'setup' },
  { uri: 'fluo://setup/troubleshooting', name: 'KMS Troubleshooting', description: 'Top 10 KMS issues', mimeType: 'text/markdown', category: 'setup' },
  // FluoDSL
  { uri: 'fluo://dsl/syntax', name: 'DSL Syntax', description: 'Complete EBNF grammar', mimeType: 'text/markdown', category: 'dsl' },
  { uri: 'fluo://dsl/patterns', name: 'DSL Patterns', description: '50+ rule templates', mimeType: 'text/markdown', category: 'dsl' },
  { uri: 'fluo://dsl/validation', name: 'DSL Validation', description: 'Security limits & debugging', mimeType: 'text/markdown', category: 'dsl' },
  { uri: 'fluo://dsl/translation', name: 'DSL Translation', description: 'DSL to Drools DRL', mimeType: 'text/markdown', category: 'dsl' },
  // AI Safety
  { uri: 'fluo://ai-safety/enterprise', name: 'AI Safety Enterprise', description: 'Agent monitoring & bias detection', mimeType: 'text/markdown', category: 'ai-safety' },
  { uri: 'fluo://ai-safety/quick-start', name: 'AI Safety Quick Start', description: '30-min AI safety setup', mimeType: 'text/markdown', category: 'ai-safety' },
  // Compliance
  { uri: 'fluo://compliance/status', name: 'Compliance Status', description: 'SOC2/HIPAA status', mimeType: 'text/markdown', category: 'compliance' },
  { uri: 'fluo://compliance/integration', name: 'Compliance Integration', description: '@SOC2/@HIPAA annotations', mimeType: 'text/markdown', category: 'compliance' },
  // Skills
  ...['architecture', 'fluo-dsl', 'security', 'compliance', 'quality', 'implementation', 'product', 'java-quarkus', 'react-tanstack', 'nix'].map(skill => ({
    uri: `fluo://skills/${skill}`,
    name: `${skill.charAt(0).toUpperCase() + skill.slice(1)} Skill`,
    description: `FLUO ${skill} skill`,
    mimeType: 'text/markdown',
    category: 'skills'
  }))
];

// File mappings
const fileMappings: Record<string, string> = {
  'fluo://setup/quickstart': 'docs/setup/KMS_QUICKSTART.md',
  'fluo://setup/aws-kms': 'docs/setup/AWS_KMS_SETUP.md',
  'fluo://setup/troubleshooting': 'docs/setup/KMS_TROUBLESHOOTING.md',
  'fluo://dsl/syntax': '.skills/fluo-dsl/syntax-reference.md',
  'fluo://dsl/patterns': '.skills/fluo-dsl/pattern-library.md',
  'fluo://dsl/validation': '.skills/fluo-dsl/validation-guide.md',
  'fluo://dsl/translation': '.skills/fluo-dsl/translation-guide.md',
  'fluo://ai-safety/enterprise': 'marketing/docs/AI-SAFETY-FOR-ENTERPRISE.md',
  'fluo://ai-safety/quick-start': 'docs/ai-safety/AI-SAFETY-REPORT-QUICK-START.md',
  'fluo://compliance/status': 'docs/compliance-status.md',
  'fluo://compliance/integration': 'docs/compliance.md',
};

async function readDoc(uri: string): Promise<string> {
  const skillMatch = uri.match(/^fluo:\/\/skills\/(.+)$/);
  if (skillMatch) {
    return await fs.readFile(path.join(FLUO_ROOT, `.skills/${skillMatch[1]}/SKILL.md`), 'utf-8');
  }
  const filePath = fileMappings[uri];
  if (!filePath) throw new Error(`No mapping for ${uri}`);
  return await fs.readFile(path.join(FLUO_ROOT, filePath), 'utf-8');
}

// Create MCP server
const server = new Server(
  { name: 'fluo-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
);

// Tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'create_fluo_dsl_rule',
      description: 'Generate FluoDSL from natural language',
      inputSchema: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'Rule description (e.g., "Detect PII access without audit")' },
          use_case: { type: 'string', enum: ['sre', 'developer', 'compliance', 'ai-safety', 'security', 'performance'], description: 'Use case category' }
        },
        required: ['description', 'use_case']
      }
    },
    {
      name: 'validate_fluo_dsl',
      description: 'Validate DSL syntax & security limits (64KB, 10KB strings, 50 levels)',
      inputSchema: {
        type: 'object',
        properties: {
          dsl_code: { type: 'string', description: 'FluoDSL code to validate' }
        },
        required: ['dsl_code']
      }
    },
    {
      name: 'search_fluo_docs',
      description: 'Search FLUO documentation',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          category: { type: 'string', enum: ['setup', 'dsl', 'ai-safety', 'compliance', 'skills', 'all'], description: 'Category filter' }
        },
        required: ['query']
      }
    }
  ]
}));

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (!args) throw new Error(`Tool ${name} requires arguments`);

  if (name === 'create_fluo_dsl_rule') {
    const desc = (args.description as string).toLowerCase();
    let dsl = '';
    
    if (desc.includes('pii') && desc.includes('audit')) {
      dsl = 'trace.has(database.query).where(data.contains_pii == true)\n  and trace.has(audit.log)';
    } else if (desc.includes('agent') && desc.includes('goal')) {
      dsl = 'trace.has(agent.plan.created) and trace.has(agent.plan.executed)\n  and trace.goal_deviation(original_goal, current_actions) > threshold';
    } else if (desc.includes('hallucination')) {
      dsl = 'trace.has(factual_claim)\n  and confidence_score < 0.7\n  and not trace.has(uncertainty_disclosure)';
    } else {
      dsl = `trace.has(span.name.matches("${desc.slice(0, 50)}"))\n  and span.attribute("status") == "completed"`;
    }

    return {
      content: [{
        type: 'text',
        text: `# Generated FluoDSL Rule\n\n**Description**: ${args.description}\n**Use Case**: ${args.use_case}\n\n\`\`\`\n${dsl}\n\`\`\`\n\n**Next Steps**:\n1. Copy to FLUO Rule Editor\n2. Test with sample traces\n3. Validate with \`validate_fluo_dsl\` tool\n4. Deploy`
      }]
    };
  }

  if (name === 'validate_fluo_dsl') {
    const code = args.dsl_code as string;
    const errors: string[] = [];
    
    if (code.length > 64 * 1024) errors.push('DSL exceeds 64KB limit');
    const strings = code.match(/"[^"]*"/g) || [];
    for (const s of strings) {
      if (s.length > 10 * 1024) errors.push(`String exceeds 10KB: ${s.slice(0, 50)}...`);
    }
    
    let depth = 0, maxDepth = 0;
    for (const c of code) {
      if (c === '(' || c === '{') { depth++; maxDepth = Math.max(maxDepth, depth); }
      else if (c === ')' || c === '}') depth--;
    }
    if (maxDepth > 50) errors.push(`Nesting depth ${maxDepth} exceeds 50 levels`);
    
    const status = errors.length > 0 ? 'INVALID' : 'VALID';
    return {
      content: [{
        type: 'text',
        text: `# Validation Result\n\n**Status**: ${status}\n\n**Security Limits**:\n- DSL size: ${code.length} bytes (max 64KB)\n- Max string: ${Math.max(...strings.map(s => s.length), 0)} bytes (max 10KB)\n- Nesting: ${maxDepth} levels (max 50)\n\n**Errors**:\n${errors.length > 0 ? errors.map(e => `- ❌ ${e}`).join('\n') : '- None'}`
      }]
    };
  }

  if (name === 'search_fluo_docs') {
    const query = (args.query as string).toLowerCase();
    const category = (args.category as string) || 'all';
    const matches = resources.filter(r =>
      (category === 'all' || r.category === category) &&
      (r.name.toLowerCase().includes(query) || r.description.toLowerCase().includes(query))
    );
    
    return {
      content: [{
        type: 'text',
        text: `# Search Results\n\n**Query**: ${args.query}\n**Category**: ${category}\n**Found**: ${matches.length}\n\n${matches.map(r => `### ${r.name}\n- URI: \`${r.uri}\`\n- ${r.description}`).join('\n\n')}`
      }]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Resources handler
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: resources.map(r => ({ uri: r.uri, name: r.name, description: r.description, mimeType: r.mimeType }))
}));

// Read resource handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  const resource = resources.find(r => r.uri === uri);
  if (!resource) throw new Error(`Resource not found: ${uri}`);
  
  const content = await readDoc(uri);
  return {
    contents: [{ uri, mimeType: resource.mimeType, text: content }]
  };
});

// Express app
const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'UP', server: 'fluo-mcp-server', version: '1.0.0', resources: resources.length, tools: 3 });
});

app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true
  });
  
  res.on('close', () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => {
  console.log(`[MCP] FLUO MCP Server started`);
  console.log(`[MCP] Endpoint: http://localhost:${PORT}/mcp`);
  console.log(`[MCP] Health: http://localhost:${PORT}/health`);
  console.log(`[MCP] Resources: ${resources.length}, Tools: 3`);
});
