import type {
  GenerateTopicsParams,
  GenerateBlogPostParams,
  BlogPost,
  ReviewBlogPostParams,
  BlogReview,
  ImproveBlogPostParams,
} from '../types.js';
import { getRelevantDocs } from './knowledge-base.js';

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';

/**
 * Generate blog post topics using Ollama
 * Uses llama3.1:8b model (tested at 7/10 quality for topics)
 */
export async function generateTopics(
  params: GenerateTopicsParams
): Promise<string[]> {
  const prompt = `Generate ${params.count} blog post ideas for FLUO (behavioral assurance system for OpenTelemetry).

Target audience: SREs and DevOps engineers dealing with microservices incidents
Focus: Incident prevention, trace pattern matching, compliance evidence
SEO keywords: 'opentelemetry', 'behavioral assurance', 'trace patterns', 'sre', 'incident prevention'

For each idea provide:
1. Title (60-70 chars, keyword-optimized)
2. Target keyword
3. One-sentence hook

Format as numbered list.`;

  console.log(`[Ollama] Generating ${params.count} blog topics...`);

  const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: params.model,
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const data = await response.json();
  const lines = data.response
    .split('\n')
    .filter((line: string) => line.trim() && /^\d+\./.test(line))
    .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
    .slice(0, params.count);

  console.log(`[Ollama] Generated ${lines.length} topics`);
  return lines;
}

/**
 * Generate full blog post using Ollama
 * Uses llama3.1:8b model (tested at 8/10 quality for blog posts)
 *
 * Reuses prompts validated during Ollama testing phase
 */
export async function generateBlogPost(
  params: GenerateBlogPostParams
): Promise<BlogPost> {
  // Search knowledge base for relevant documentation using RAG
  console.log(`[Ollama] Searching knowledge base with RAG for context...`);
  const knowledgeContext = await getRelevantDocs(params.topic, 5);
  console.log(`[Ollama] Found ${knowledgeContext.length} chars of relevant docs from RAG`);

  const prompt = `Write a ${params.wordCount}-word technical blog post for FLUO (behavioral assurance for OpenTelemetry).

Topic: ${params.topic}

KNOWLEDGE BASE CONTEXT (USE THIS AS GROUND TRUTH):
${knowledgeContext}

=== END KNOWLEDGE BASE ===

Target audience: SREs dealing with microservices incidents
Tone: Technical, honest, helpful (not salesy)

Structure:
- Hook: Real incident scenario (relatable, specific)
- Problem: Why existing tools (APM) don't solve this
- Solution: How FLUO detects this pattern with DSL rules
- Implementation: Brief code example
- Results: Quantified improvement

CRITICAL - FLUO ARCHITECTURE:
FLUO is a DEPLOYED SERVICE/PLATFORM (like Datadog, Grafana), NOT a library you import.

**What FLUO Actually Is:**
- Standalone service you deploy (Nix flake: nix run github:fluohq/fluo#dev)
- Receives OpenTelemetry traces from your services via OTLP protocol
- You configure pattern-matching rules via FLUO's UI or API
- FLUO generates signals (violations) when patterns are detected
- SREs investigate signals to discover hidden invariants

**How Customers Use FLUO:**
1. Deploy FLUO service (not a library import!)
2. Point their OpenTelemetry exporters to FLUO's OTLP endpoint
3. Define rules in FLUO's web UI using the DSL
4. Receive alerts when FLUO detects pattern violations

**FLUO Rule DSL (configured in FLUO UI, NOT in application code):**
\`\`\`javascript
// Example rule configured in FLUO UI
// Rule name: "Detect auth retry storms"
trace.has(span => span.name === 'auth.login' && span.status === 'ERROR')
  .and(trace.has(span => span.name === 'auth.login' && span.status === 'OK'))
  .within('5 seconds')

// Rule: "Missing audit logs after PII access"
trace.has(span => span.attributes['data.contains_pii'] === true)
  .and(trace.missing(span => span.name === 'audit.log'))

// Rule: "Slow payment queries"
trace.where(span => span.name.startsWith('payment'))
  .has(span => span.name.includes('db.query') && span.duration > 1000)
\`\`\`

**What OpenTelemetry Traces Look Like (sent to FLUO via OTLP):**
\`\`\`javascript
// Your services send these spans to FLUO (via OTel SDK)
{
  name: "http.request",
  traceId: "abc123",
  spanId: "def456",
  parentSpanId: "ghi789",
  status: "OK" | "ERROR",
  duration: 150, // milliseconds
  attributes: {
    "http.method": "POST",
    "http.status_code": 200,
    "service.name": "api-gateway"
  }
}
\`\`\`

**Blog Post Requirements:**
- Show FLUO as a deployed service, NOT a library
- Rules are configured in FLUO UI/API, NOT in application code
- Applications only send OpenTelemetry traces (standard OTLP)
- Use realistic deployment examples (nix run, Docker, K8s)
- NO fictional imports like "import fluo from '@fluo/sdk'" - FLUO is not a library!

CTA: 'Try FLUO: github.com/fluohq/fluo'

Format as markdown with proper headings.`;

  console.log(`[Ollama] Generating blog post for: "${params.topic}"...`);
  console.log(`[Ollama] Target word count: ${params.wordCount}`);

  const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: params.model,
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const data = await response.json();
  const date = new Date().toISOString().split('T')[0];

  // Generate filename from topic
  const filename = `${date}-${params.topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60)}.md`;

  // Add markdown frontmatter
  const frontmatter = `---
title: "${params.topic}"
date: ${date}
author: FLUO Team
tags: [opentelemetry, behavioral-assurance, sre]
draft: true
---

`;

  const content = frontmatter + data.response;
  const wordCount = content.split(/\s+/).length;

  console.log(`[Ollama] Generated blog post: ${filename} (${wordCount} words)`);

  return {
    filename,
    content,
    topic: params.topic,
    wordCount,
  };
}

/**
 * Review blog post from a specific perspective
 * Returns structured feedback with score and actionable improvements
 */
export async function reviewBlogPost(
  params: ReviewBlogPostParams
): Promise<BlogReview> {
  const perspectivePrompts = {
    'technical-accuracy': `You are a senior SRE reviewing this blog post for TECHNICAL ACCURACY.

Check for:
- Correct OpenTelemetry concepts and terminology
- Accurate descriptions of distributed tracing
- Valid technical claims that can be verified
- Correct code syntax and examples
- Realistic metrics and performance claims

Rate 1-10 where:
- 1-3: Major technical errors, false claims
- 4-6: Some inaccuracies, needs verification
- 7-8: Mostly accurate, minor issues
- 9-10: Technically sound, verifiable claims

Provide JSON response:
{
  "score": <1-10>,
  "strengths": ["list", "of", "accurate", "points"],
  "weaknesses": ["list", "of", "inaccurate", "claims"],
  "suggestions": ["how", "to", "fix", "issues"],
  "mustFix": ["critical", "errors", "that", "must", "be", "corrected"]
}`,

    'authenticity': `You are a content editor reviewing this blog post for AUTHENTICITY and VOICE.

Check for:
- Does it sound like AI wrote it? (generic, robotic, formulaic)
- Are examples specific or vague/generic?
- Is the tone conversational and relatable?
- Does it show real experience or just book knowledge?
- Are there clichés, buzzwords, or marketing fluff?

Rate 1-10 where:
- 1-3: Obviously AI-generated, generic, salesy
- 4-6: Some personality but still feels automated
- 7-8: Reads naturally, some authentic voice
- 9-10: Human-like, specific examples, genuine insights

Provide JSON response:
{
  "score": <1-10>,
  "strengths": ["authentic", "elements"],
  "weaknesses": ["robotic", "or", "generic", "parts"],
  "suggestions": ["how", "to", "add", "authenticity"],
  "mustFix": ["obviously", "AI", "sections"]
}`,

    'claims-verification': `You are a fact-checker reviewing this blog post for UNSUBSTANTIATED CLAIMS.

Check for:
- Are performance claims backed by data?
- Are comparisons to other tools fair and accurate?
- Are capabilities exaggerated?
- Are there weasel words ("can", "might", "potentially")?
- Are benefits quantified or vague?

Rate 1-10 where:
- 1-3: Many unsubstantiated claims, exaggerations
- 4-6: Some claims lack evidence
- 7-8: Most claims supported, minor issues
- 9-10: All claims backed by evidence or caveated

Provide JSON response:
{
  "score": <1-10>,
  "strengths": ["well", "supported", "claims"],
  "weaknesses": ["unsupported", "exaggerations"],
  "suggestions": ["how", "to", "substantiate", "claims"],
  "mustFix": ["false", "or", "misleading", "statements"]
}`,

    'structure-clarity': `You are an editor reviewing this blog post for STRUCTURE and CLARITY.

Check for:
- Is the problem clearly defined?
- Does the solution logically follow?
- Are examples easy to follow?
- Is the flow logical and coherent?
- Is the call-to-action clear?

Rate 1-10 where:
- 1-3: Confusing, illogical, hard to follow
- 4-6: Some clarity issues, needs restructuring
- 7-8: Clear structure, minor improvements
- 9-10: Crystal clear, logical flow, easy to follow

Provide JSON response:
{
  "score": <1-10>,
  "strengths": ["clear", "sections"],
  "weaknesses": ["confusing", "parts"],
  "suggestions": ["structural", "improvements"],
  "mustFix": ["critical", "clarity", "issues"]
}`,

    'seo-effectiveness': `You are an SEO specialist reviewing this blog post for SEARCH OPTIMIZATION and DISCOVERABILITY.

Check for:
- Are target keywords naturally integrated?
- Is the title compelling and keyword-optimized (50-60 chars)?
- Does it answer a specific search intent?
- Are headers (H2/H3) descriptive and keyword-rich?
- Is there a clear hook that matches what users search for?
- Would this rank for relevant SRE/OpenTelemetry queries?

Rate 1-10 where:
- 1-3: No SEO optimization, generic title, no clear intent
- 4-6: Some keywords but poor integration, weak title
- 7-8: Good SEO structure, relevant keywords, clear intent
- 9-10: Excellent SEO, naturally optimized, high ranking potential

Provide JSON response:
{
  "score": <1-10>,
  "strengths": ["seo", "strengths"],
  "weaknesses": ["seo", "issues"],
  "suggestions": ["seo", "improvements"],
  "mustFix": ["critical", "seo", "problems"]
}`,

    'marketing-impact': `You are a B2B SaaS marketing specialist reviewing this blog post for MARKETING IMPACT and CONVERSION.

Check for:
- Does it hook the target audience (SREs) immediately?
- Is there a clear pain point → solution arc?
- Does it build credibility and trust?
- Is the call-to-action compelling and low-friction?
- Would this convert readers to try FLUO?
- Does it differentiate from APM/monitoring competitors?

Rate 1-10 where:
- 1-3: No marketing value, won't convert, generic
- 4-6: Some value but weak positioning/CTA
- 7-8: Good marketing, clear value prop, decent CTA
- 9-10: Exceptional marketing, highly persuasive, strong conversion potential

Provide JSON response:
{
  "score": <1-10>,
  "strengths": ["marketing", "strengths"],
  "weaknesses": ["marketing", "issues"],
  "suggestions": ["conversion", "improvements"],
  "mustFix": ["critical", "marketing", "gaps"]
}`,

    'security-expert': `You are a cybersecurity expert reviewing this blog post for SECURITY CREDIBILITY and ACCURACY.

Check for:
- Are security concepts (compliance, evidence, audit trails) accurate?
- Are threat models realistic and not fear-mongering?
- Is the security architecture sound (sandboxing, isolation, crypto)?
- Are claims about SOC2/HIPAA/compliance verifiable?
- Does it avoid security theater or snake oil?
- Would a security professional trust this?

Rate 1-10 where:
- 1-3: Major security misunderstandings, false claims
- 4-6: Some security concepts but inaccurate/incomplete
- 7-8: Solid security understanding, minor gaps
- 9-10: Expert-level security accuracy, trustworthy

Provide JSON response:
{
  "score": <1-10>,
  "strengths": ["security", "strengths"],
  "weaknesses": ["security", "inaccuracies"],
  "suggestions": ["security", "improvements"],
  "mustFix": ["critical", "security", "errors"]
}`,

    'developer-experience': `You are a senior developer reviewing this blog post for DEVELOPER EXPERIENCE and PRACTICALITY.

Check for:
- Are code examples copy-pasteable and correct?
- Is the integration path clear and realistic?
- Would a developer want to try this after reading?
- Are dependencies, prerequisites, and limitations clear?
- Is the "time to first value" obvious?
- Does it respect developer intelligence (not dumbed down)?

Rate 1-10 where:
- 1-3: Confusing, broken examples, no clear path forward
- 4-6: Some guidance but gaps in implementation details
- 7-8: Clear implementation path, good examples
- 9-10: Exceptional developer experience, want to try immediately

Provide JSON response:
{
  "score": <1-10>,
  "strengths": ["dx", "strengths"],
  "weaknesses": ["dx", "gaps"],
  "suggestions": ["dx", "improvements"],
  "mustFix": ["critical", "dx", "blockers"]
}`,

    'presentation-design': `You are a StageTime University presentation expert reviewing this blog post for VISUAL STORYTELLING and NARRATIVE FLOW.

Check for:
- Does it follow a clear narrative arc (hook → problem → solution → result)?
- Are sections properly chunked for scanability?
- Would this work as a conference talk structure?
- Is there a "big reveal" or compelling insight?
- Does it use metaphors, analogies, or storytelling effectively?
- Is the pacing engaging (not too dense, not too shallow)?

Rate 1-10 where:
- 1-3: No narrative structure, wall of text, boring
- 4-6: Some structure but poor flow or pacing
- 7-8: Good narrative arc, engaging structure
- 9-10: Exceptional storytelling, would make a great talk

Provide JSON response:
{
  "score": <1-10>,
  "strengths": ["presentation", "strengths"],
  "weaknesses": ["presentation", "issues"],
  "suggestions": ["narrative", "improvements"],
  "mustFix": ["critical", "narrative", "failures"]
}`,

    'storytelling': `You are a content strategist reviewing this blog post for EMOTIONAL RESONANCE and RELATABILITY.

Check for:
- Does it tell a specific, relatable incident story?
- Are there concrete details (not generic "a company had a problem")?
- Does it evoke emotion (frustration with incidents, relief with solution)?
- Would an SRE see themselves in this story?
- Is there a protagonist and a transformation?
- Does it avoid corporate speak and buzzwords?

Rate 1-10 where:
- 1-3: No story, generic examples, corporate speak
- 4-6: Some story elements but weak or generic
- 7-8: Good storytelling, specific and relatable
- 9-10: Exceptional storytelling, emotionally compelling

Provide JSON response:
{
  "score": <1-10>,
  "strengths": ["story", "strengths"],
  "weaknesses": ["story", "gaps"],
  "suggestions": ["storytelling", "improvements"],
  "mustFix": ["critical", "storytelling", "failures"]
}`,

    'code-quality': `You are a software architect reviewing this blog post for CODE EXAMPLE QUALITY and BEST PRACTICES.

Check for:
- Do code examples follow language idioms and best practices?
- Is error handling shown (not just happy paths)?
- Are examples production-ready or toy code?
- Is the code well-formatted and readable?
- Are there security anti-patterns (hardcoded secrets, SQL injection)?
- Would you approve this code in a PR?

Rate 1-10 where:
- 1-3: Broken, insecure, or anti-pattern code
- 4-6: Works but not production-ready or has issues
- 7-8: Good code quality, minor improvements possible
- 9-10: Excellent code, production-ready, best practices

Provide JSON response:
{
  "score": <1-10>,
  "strengths": ["code", "strengths"],
  "weaknesses": ["code", "issues"],
  "suggestions": ["code", "improvements"],
  "mustFix": ["critical", "code", "errors"]
}`,
  };

  const prompt = `${perspectivePrompts[params.perspective]}

Blog post to review:
---
${params.content}
---

Provide your review as valid JSON only (no additional text).`;

  console.log(`[Ollama] Reviewing blog post: ${params.perspective}...`);

  const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: params.model,
      prompt,
      stream: false,
      format: 'json',
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const data = await response.json();
  const review = JSON.parse(data.response);

  // Ensure all fields exist with defaults
  const mustFix = Array.isArray(review.mustFix) ? review.mustFix : [];
  const strengths = Array.isArray(review.strengths) ? review.strengths : [];
  const weaknesses = Array.isArray(review.weaknesses) ? review.weaknesses : [];
  const suggestions = Array.isArray(review.suggestions) ? review.suggestions : [];
  const recommendations = Array.isArray(review.recommendations) ? review.recommendations : [];

  console.log(`[Ollama] Review (${params.perspective}): ${review.score}/10`);
  console.log(`[Ollama] Must fix: ${mustFix.length} critical issues`);
  console.log(`[Ollama] Recommendations: ${recommendations.length} actionable items`);

  return {
    perspective: params.perspective,
    score: review.score || 0,
    strengths,
    weaknesses,
    suggestions,
    mustFix,
    recommendations,
  };
}

/**
 * Improve blog post based on review feedback
 * Iterates on content to address all critical issues
 */
export async function improveBlogPost(
  params: ImproveBlogPostParams
): Promise<BlogPost> {
  const criticalIssues = params.reviews.flatMap((r) => r.mustFix);
  const allSuggestions = params.reviews.flatMap((r) => r.suggestions);

  const prompt = `You are improving a blog post based on expert reviews. The goal is to reach ${params.targetScore}/10 quality.

Current average score: ${(params.reviews.reduce((sum, r) => sum + r.score, 0) / params.reviews.length).toFixed(1)}/10

CRITICAL ISSUES (must fix):
${criticalIssues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

SUGGESTIONS FOR IMPROVEMENT:
${allSuggestions.map((sug, i) => `${i + 1}. ${sug}`).join('\n')}

REVIEW BREAKDOWN:
${params.reviews.map((r) => `- ${r.perspective}: ${r.score}/10
  Weaknesses: ${r.weaknesses.join(', ')}`).join('\n')}

Original blog post:
---
${params.originalContent}
---

Rewrite the blog post addressing ALL critical issues and as many suggestions as possible.
Maintain the same structure (frontmatter + content) but improve quality significantly.

Requirements:
- Fix ALL critical issues
- Use specific, verifiable examples
- Remove AI-sounding language
- Substantiate all claims with data or caveats
- Maintain technical accuracy
- Keep conversational, helpful tone

Output the complete improved blog post (with frontmatter).`;

  console.log(`[Ollama] Improving blog post...`);
  console.log(`[Ollama] ${criticalIssues.length} critical issues to fix`);

  const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: params.model,
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const data = await response.json();
  const improvedContent = data.response;

  // Extract filename from original frontmatter
  const filenameMatch = params.originalContent.match(/^---\n[\s\S]*?---\n/);
  const filename = filenameMatch
    ? `improved-${Date.now()}.md`
    : `${new Date().toISOString().split('T')[0]}-improved.md`;

  const wordCount = improvedContent.split(/\s+/).length;

  console.log(`[Ollama] Improved blog post: ${wordCount} words`);

  return {
    filename,
    content: improvedContent,
    topic: 'Improved version',
    wordCount,
  };
}