# BeTrace vs LangSmith: When to Use Each (And When to Use Both)

**Last Updated:** October 2025

---

## TL;DR

**LangSmith**: LLM/agent lifecycle platform for debugging, tracing, evaluating, and monitoring LangChain workflows and AI agents.

**BeTrace**: Behavioral invariant detection system - code emits context via spans, BeTrace DSL matches patterns, produces signals and metrics.

**When to use LangSmith**: You're building LLM applications with LangChain and need specialized tracing, prompt management, and evaluations.

**When to use BeTrace**: You need pattern matching on contextual trace data across any system (not just LLMs) with rule replay.

**When to use both**: LangSmith traces LLM internals (prompts, tokens, latency), BeTrace validates behavioral patterns (goal deviation, tool authorization).

---

## What is LangSmith?

LangSmith is a platform for the entire lifecycle of LLM-powered applications, from development to production monitoring. Developed by the LangChain team, it excels at tracing complex LangChain workflows.

**Core capabilities:**
- **LLM Tracing**: Trace prompts, completions, token usage, latency across chains
- **Prompt Hub**: Version control and collaboration for prompts
- **Evaluations**: Test LLM outputs against datasets (accuracy, hallucinations)
- **Debugging**: Replay specific LLM calls, inspect intermediate steps
- **Annotations**: Human feedback on LLM outputs

**Core workflow:**
```
LangChain app → LangSmith SDK → Trace LLM calls → Debug + Evaluate
```

**Value proposition**: Purpose-built for LLM workflows - understand why your agent made a decision, optimize prompts, catch regressions.

---

## What is BeTrace?

BeTrace is a behavioral invariant detection system. Code emits contextual data as OpenTelemetry spans, BeTrace DSL defines pattern-matching rules, and BeTrace engine produces signals and metrics when patterns match (or don't match).

**Core workflow:**
```
Code emits context (spans) → BeTrace DSL (pattern matching) → Signals + Metrics
```

**Key capabilities:**
1. **Pattern Matching**: Match contextual span data against user-defined rules
2. **Rule Replay**: Retroactively apply rules to historical traces (seconds, not hours)
3. **Flexible Context**: Code defines what context to emit; rules define what patterns to detect

**Value proposition**: Define patterns once, detect violations instantly, and retroactively replay rules against historical traces without expensive reprocessing.

---

## Key Differences

| **Dimension** | **LangSmith** | **BeTrace** |
|--------------|----------|----------|
| **Primary Focus** | LLM/agent workflows (LangChain) | General behavioral patterns (any system) |
| **Data Source** | LangChain SDK (prompts, tokens, chains) | OpenTelemetry (contextual span attributes) |
| **Detection Method** | Evaluations (datasets), manual inspection | BeTrace DSL pattern matching (rules) |
| **Rule Replay** | No (traces stored, but no rule replay) | **Yes** (key differentiator) |
| **Ecosystem** | LangChain-native (tight integration) | OpenTelemetry-native (any instrumented system) |
| **Output** | Trace visualizations, eval scores | Signals (pattern violations) |

---

## When to Use LangSmith

Use LangSmith when you need:

### 1. LangChain-Specific Tracing
You're building with LangChain and need visibility into chains, agents, tools, and prompts.

**Example**: "Why did my customer support agent call the wrong tool?"

**LangSmith workflow:**
1. LangChain app emits traces (automatic with `langsmith` SDK)
2. View trace: Prompt → LLM reasoning → Tool selection → Result
3. Inspect: Agent chose `escalate_to_human` instead of `search_kb`
4. Debug: Prompt ambiguous ("escalate" mentioned in user query)

---

### 2. Prompt Management and Versioning
You want to version prompts, A/B test variations, and collaborate with team.

**Example**: "Test 3 prompt variations for summarization quality."

**LangSmith Prompt Hub:**
1. Save prompt: `summarize_v1` → "Summarize the following text:"
2. Create variations: `summarize_v2` → "Provide a concise summary:"
3. A/B test: Run evaluations on dataset (1000 docs)
4. Result: `summarize_v2` scores 15% higher on coherence

---

### 3. LLM Evaluations (Accuracy, Hallucinations)
You want to test LLM outputs against ground truth datasets.

**Example**: "Measure hallucination rate in medical Q&A agent."

**LangSmith evaluations:**
1. Create dataset: 500 medical questions + verified answers
2. Run agent on dataset
3. Evaluate: Compare agent outputs to ground truth
4. Metrics: 92% accuracy, 3% hallucination rate

---

### 4. Debugging Specific LLM Calls
You want to replay specific LLM requests, inspect prompts/completions.

**Example**: "Why did agent hallucinate patient name?"

**LangSmith debugging:**
1. Find trace ID for failed request
2. Inspect prompt: Context includes "John Doe" (wrong patient)
3. Root cause: Retrieval step fetched wrong patient record
4. Fix: Improve retrieval filter (patient ID)

---

## When to Use BeTrace

Use BeTrace when you need:

### 1. Pattern Matching Across Any System (Not Just LLMs)
You want to validate patterns in any OpenTelemetry-instrumented system.

**Example**: "Agent should never access database without authorization check."

**BeTrace DSL:**
```javascript
// Signal: UNAUTHORIZED_DATABASE_ACCESS (critical)
trace.has(agent.tool).where(name == database_query)
  and not trace.has(auth.check)
```

**Why not LangSmith?**
- LangSmith: LangChain-specific (chains, agents, tools)
- BeTrace: Any system (APIs, databases, agents, services)

---

### 2. Rule Replay on Historical Traces
You want to apply rules retroactively to historical data.

**Example**: Day 30 - discover agents should never call external APIs. Replay rule against Days 1-29.

**BeTrace workflow:**
1. Day 30: Define rule ("Agent should never call `external_api` tool")
2. Rule replay: Apply to Days 1-29 traces (seconds)
3. Discovery: 34 historical violations (agents called external API)

**Why not LangSmith?**
- LangSmith: Traces stored, but no automated rule replay
- BeTrace: Automated replay against historical traces (seconds)

---

### 3. Cross-System Invariant Validation
You want to validate patterns that span multiple systems (agent + database + API).

**Example**: "Agent tool calls must follow workflow: `search` → `validate` → `execute`."

**BeTrace DSL:**
```javascript
// Signal: TOOL_WORKFLOW_VIOLATION (high)
trace.has(agent.tool).where(tool == execute)
  and not (trace.has(agent.tool).where(previous == validate)
           and trace.has(agent.tool).where(previous.previous == search))
```

**Why not LangSmith?**
- LangSmith: Focus on LLM internals (prompts, tokens, chains)
- BeTrace: Focus on system-wide patterns (cross-service invariants)

---

### 4. Continuous Behavioral Validation (Always-On)
You want rules to run continuously, not just during evaluations.

**Example**: "Agent goal deviation score should never exceed 0.6."

**BeTrace DSL:**
```javascript
// Signal: AGENT_GOAL_DEVIATION (high)
trace.has(agent.goal).where(deviation_score > 0.6)
```

**Why not LangSmith?**
- LangSmith: Evaluations run on-demand (dataset-based)
- BeTrace: Rules always-on (continuous validation)

---

## When to Use Both (The Power Combo)

The most powerful scenario is using **LangSmith for LLM debugging** and **BeTrace for behavioral validation**.

### Scenario 1: Healthcare AI Agent (Medical Q&A)

**LangSmith traces:**
- User query: "What is the treatment for diabetes?"
- Agent reasoning: Retrieval → LLM completion → Response
- Prompt engineering: Optimize for medical accuracy

**BeTrace validates:**
- "Agent should never provide treatment recommendations without citing sources"
- "Agent should never access patient data without authorization"

**BeTrace DSL:**
```javascript
// Signal: UNSOURCED_MEDICAL_ADVICE (critical)
trace.has(agent.response).where(response matches ".*treatment.*")
  and not trace.has(agent.sources).where(cited > 0)

// Signal: UNAUTHORIZED_PATIENT_ACCESS (critical)
trace.has(agent.tool).where(name == patient_records)
  and not trace.has(auth.role).where(role == healthcare_provider)
```

**Result**:
- LangSmith: Debug LLM reasoning (prompt optimization, hallucination detection)
- BeTrace: Validate behavioral invariants (sources cited, authorization checked)

---

### Scenario 2: Customer Support Agent

**LangSmith traces:**
- User query: "Cancel my subscription"
- Agent workflow: `search_kb` → `verify_identity` → `cancel_subscription`
- Evaluation: 95% accuracy on test dataset

**BeTrace validates:**
- "Identity verification must precede account actions"
- "Cancellation must generate audit log"

**BeTrace DSL:**
```javascript
// Signal: IDENTITY_VERIFICATION_MISSING (critical)
trace.has(agent.tool).where(name == cancel_subscription)
  and not trace.has(agent.tool).where(previous == verify_identity)

// Signal: AUDIT_LOG_MISSING (high)
trace.has(agent.tool).where(name == cancel_subscription)
  and not trace.has(audit.log)
```

**Result**:
- LangSmith: Evaluate agent accuracy (test against dataset)
- BeTrace: Validate workflow invariants (identity check, audit log)

---

### Scenario 3: Legal Research Agent

**LangSmith traces:**
- User query: "Find cases related to patent law"
- Agent workflow: `search_cases` → `summarize` → `cite_sources`
- Prompt optimization: Improve citation format

**BeTrace validates:**
- "Agent should never access cases outside user's jurisdiction"
- "Agent should never provide legal advice (only research)"

**BeTrace DSL:**
```javascript
// Signal: JURISDICTION_VIOLATION (high)
trace.has(agent.tool).where(role == legal_research)
  and trace.has(case.query).where(case.jurisdiction != user.jurisdiction)

// Signal: LEGAL_ADVICE_DETECTED (critical)
trace.has(agent.response).where(response matches ".*(you should|I recommend).*")
```

**Result**:
- LangSmith: Debug retrieval quality (relevant cases found?)
- BeTrace: Validate compliance invariants (jurisdiction, no advice)

---

### Scenario 4: Incident Investigation (Post-Mortem)

**Day 1-29**: Agent operates normally.

**Day 30**: Incident - agent made unauthorized database query.

**LangSmith investigation:**
1. Find trace ID for incident
2. Inspect chain: User query → Agent reasoning → Tool call
3. Root cause: Agent misinterpreted query, called wrong tool

**BeTrace replay:**
1. Define rule: "Agent should never call `admin_database` tool"
2. Replay rule against Days 1-29
3. Discovery: 5 historical violations (same pattern)

**BeTrace DSL:**
```javascript
// Signal: ADMIN_DATABASE_ACCESS (critical)
trace.has(agent.tool).where(name == admin_database)
```

**Result**:
- LangSmith: Debug current incident (why did agent call wrong tool?)
- BeTrace: Discover historical pattern (5 past violations via replay)

---

## Architecture: How They Integrate

```
┌─────────────────────────────────────────────────────────┐
│              LangChain AI Agent Application              │
│  - LangSmith SDK (LLM tracing)                          │
│  - OpenTelemetry SDK (contextual span attributes)       │
└────────────┬─────────────────────────────────┬──────────┘
             │                                  │
             │ (LLM traces)                    │ (OTel traces)
             ▼                                  ▼
     ┌───────────────┐                  ┌───────────────┐
     │   LangSmith   │                  │     BeTrace      │
     │  (LLM Debug)  │                  │  (Invariants) │
     └───────┬───────┘                  └───────┬───────┘
             │                                  │
             │ Trace visualizations             │ Signals
             ▼                                  ▼
     ┌────────────────────────────────────────────────┐
     │            AI Engineering Team                 │
     │  - LangSmith: "Why did agent choose this?"     │
     │  - BeTrace: "Did agent follow expected patterns?" │
     └────────────────────────────────────────────────┘
```

**Data flow:**
1. **LangChain agent** emits:
   - LangSmith: LLM traces (prompts, tokens, chains)
   - OpenTelemetry: Contextual attributes (tool calls, auth checks, goals)
2. **LangSmith** debugs: LLM reasoning, prompt quality
3. **BeTrace** validates: Behavioral patterns, invariants
4. **Engineering team** uses both:
   - LangSmith: "Agent chose wrong tool because prompt was ambiguous"
   - BeTrace: "Agent violated authorization invariant 3 times today"

---

## Cost Comparison

| **Dimension** | **LangSmith** | **BeTrace** |
|--------------|----------|----------|
| **Pricing Model** | Per-trace pricing (LLM calls) | Per-trace volume |
| **Typical Cost** | Free tier, then $39+/month | Custom pricing |
| **Hidden Costs** | LangChain lock-in | OpenTelemetry instrumentation |
| **ROI Metric** | Prompt optimization, hallucination reduction | Violations detected |

**When cost matters:**
- **LangSmith**: Cost scales with LLM calls (sample aggressively at scale)
- **BeTrace**: Cost scales with trace volume (optimize span attributes)

**Combined approach:**
- LangSmith: Sample LLM traces at 10% for debugging
- BeTrace: 100% traces for invariant validation (critical patterns captured)

---

## Migration Paths

### Path 1: LangSmith → LangSmith + BeTrace
**Scenario**: You have LangSmith for LLM tracing, want behavioral validation + rule replay.

**Steps**:
1. Keep LangSmith for LLM debugging
2. Add OpenTelemetry instrumentation (emit contextual attributes)
3. Define BeTrace DSL rules for invariants (1 week)
4. Use both: LangSmith (debug) + BeTrace (validate)

**Result**: LLM debugging + behavioral validation.

---

### Path 2: BeTrace → BeTrace + LangSmith
**Scenario**: You have BeTrace for invariants, want LLM-specific tracing.

**Steps**:
1. Keep BeTrace for pattern matching
2. Integrate LangSmith SDK (LangChain apps)
3. Use LangSmith for prompt engineering, evaluations
4. Use both: BeTrace (invariants) + LangSmith (LLM optimization)

**Result**: Behavioral validation + LLM optimization.

---

## Summary

| **Question** | **Answer** |
|-------------|-----------|
| **Building LangChain apps?** | Use LangSmith (LangChain-native) |
| **Need prompt versioning and A/B testing?** | Use LangSmith (Prompt Hub) |
| **Need LLM evaluations (accuracy, hallucinations)?** | Use LangSmith (eval datasets) |
| **Need pattern matching across any system?** | Use BeTrace (OpenTelemetry-native) |
| **Need rule replay on historical traces?** | Use BeTrace (key differentiator) |
| **Need continuous behavioral validation?** | Use BeTrace (always-on rules) |
| **Want LLM debugging + behavioral validation?** | Use both (LangSmith + BeTrace) |

**The power combo**: LangSmith debugs LLM internals (prompts, chains, reasoning), BeTrace validates system-wide patterns (authorization, workflows, invariants).

---

## Next Steps

**Exploring LangSmith?**
- [LangSmith Docs](https://docs.smith.langchain.com)
- [LangChain Integration](https://python.langchain.com/docs/langsmith/)

**Exploring BeTrace?**
- [BeTrace DSL Documentation](../../docs/technical/trace-rules-dsl.md)
- [AI Agent Monitoring Guide](../../backend/docs/AI_AGENT_MONITORING_GUIDE.md)

**Questions?**
- LangSmith: [LangChain Community](https://github.com/langchain-ai/langsmith-sdk)
- BeTrace: [GitHub Issues](https://github.com/betracehq/betrace)
