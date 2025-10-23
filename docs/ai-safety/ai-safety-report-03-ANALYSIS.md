# AI Safety Report - Capabilities Section Analysis

## WHY THIS SECTION EXISTS
Establish technical foundation for understanding AI risk: "What can AI do?" determines "What risks does it pose?" and "What mitigations are needed?"

## TARGET AUDIENCE
Policymakers who need technical context without requiring deep ML expertise. Developers who need shared terminology.

---

## KEY IDEAS: How AI Is Developed (1.1)

### The AI Lifecycle Has 6 Distinct Stages

**1. Data collection & pre-processing** (labor-intensive)
- Scrape internet, clean, label, filter
- Copyright/privacy concerns start here
- Annotation teams, quality classification
- **BeTrace relevance**: Training data provenance = compliance requirement

**2. Pre-training** (compute-intensive)
- Feed billions of examples to untrained model
- Produces "base model" with general knowledge
- Takes weeks/months, uses tens of thousands of GPUs
- **Costs**: $1B+ by 2027 for largest models
- **10 billion times more compute** than 2010
- **BeTrace relevance**: Not directly monitorable (internal training process)

**3. Fine-tuning** (labor + moderate compute)
- Refine base model with specialized feedback
- Human raters mark good/bad responses
- Model learns to favor successful approaches
- **Increasingly using AI to fine-tune AI** (recursive improvement)
- **BeTrace relevance**: Fine-tuning = behavior shaping → patterns change over time

**4. System integration** (engineering-intensive)
- Combine model + UI + filters + scaffolding + tools
- **Example**: GPT-4 (model) → ChatGPT (system with web access, memory, plugins)
- Produces "system card" documenting capabilities/tests
- **BeTrace relevance**: THIS IS WHERE BEHAVIORAL PATTERNS EMERGE
  - Scaffolding = autonomous behavior
  - Tool access = capability expansion
  - Filters = safety constraints (can fail)

**5. Deployment**
- Internal use vs. external use
- API access vs. web interface
- "Open-weight" vs. closed models
- **BeTrace relevance**: Production environment = where BeTrace operates

**6. Post-deployment monitoring**
- Gather user feedback, track metrics
- Iterative improvements
- "Cat-and-mouse game" of fixing discovered issues
- **BeTrace relevance**: THIS IS BeTrace'S PRIMARY VALUE - continuous behavioral observation

### Critical Insight: Different Stages = Different Policy Levers

**Report quote**:
> "These stages occur at different points in time, depend on different resources, require different techniques, and are sometimes undertaken by different developers. As a result, different policies and regulations affecting data, computational resources ('compute'), or human oversight may affect each stage differently."

**BeTrace implication**:
- Pre-training/fine-tuning = upstream (model developers)
- System integration/deployment = downstream (can be different org)
- **BeTrace monitors downstream** (where systems actually run)
- **Independent of upstream choices** (works regardless of model provider)

### New Development: Inference Scaling (o1, Chain-of-Thought)

**Report quote**:
> "Since the publication of the Interim Report, developers have made significant advances in system integration techniques that may enable general-purpose AI to perform more advanced reasoning. In September 2024, OpenAI announced its new o1 prototype model with more advanced scaffolding and training methods...o1 employs 'chain of thought' problem-solving that breaks problems down into steps which are then solved bit-by-bit."

**Key implications**:
- **More compute at runtime** (not just training)
- **Reasoning becomes observable** (step-by-step chains)
- **Longer execution traces**
- **Trade-off**: Better performance but significantly more time/cost

**BeTrace opportunity**:
- Chain-of-thought = traceable reasoning process
- Each step = observable span
- Pattern matching on reasoning chains
- Detect when reasoning deviates from expected approach

---

## KEY IDEAS: Current Capabilities (1.2)

### What AI CAN Do (Consensus)

**Programming**:
- Assist programmers, small-to-medium software tasks
- Write short programs, translate between languages

**Content Generation**:
- Photorealistic images (hard to distinguish from real photos)
- Fluent conversation in many languages
- Summarize documents, answer reading comprehension

**Multi-modal**:
- Text + image + video + speech simultaneously
- 9+ modalities (including robotic actions, protein structures, music)

**Reasoning**:
- Graduate-level textbook problems
- University entrance exams
- Multi-turn conversations on wide range of topics

**Update since Interim Report**:
- **Marked improvement** in scientific reasoning and programming
- **Expert-level performance** on some tests/competitions
- **o1 breakthrough**: 83% on International Math Olympiad vs. GPT-4o's 13%

### What AI CANNOT Do (Current Limitations)

**Physical World**:
- Useful robotic household tasks (unreliable)

**Reliability**:
- Consistently avoid false statements ("hallucinations")
- Execute long independent projects (multi-day programming/research)

**Consistency**:
- Performance varies wildly by:
  - Prompting approach (user skill matters)
  - Fine-tuning details
  - Tools available
  - Context (numbers rare in training data → fails arithmetic)

### Critical Challenge: Capabilities Are Difficult to Measure

**Report quote**:
> "A general-purpose AI system's capabilities are difficult to reliably measure. An important caveat on assessments of AI capabilities is that their capability profiles, and the consistency with which they exhibit certain capabilities, differ significantly from those of humans."

**Examples of measurement problems**:
- Models fail at counting/arithmetic with rare numbers
- Success depends on specific test examples chosen
- Performance varies by how question is asked
- **Hard to ensure ABSENCE of capability** (dangerous capabilities)

**BeTrace implication**:
- **Can't rely on pre-deployment capability assessments**
- **Must observe actual production behavior**
- **Pattern violations = unexpected capability manifestation**

### AI Agents = Major Investment Area

**Report quote**:
> "Leading AI companies are making large investments in AI agents because they are expected to be economically valuable. There is rapid progress on tests related to web browsing, coding, and research tasks, though current AI agents still struggle with work that requires many steps."

**Agent definition**:
- Autonomously act, plan, delegate
- Control computers, use software tools
- Work toward goals with minimal oversight
- Multi-step operations

**Current status**:
- Not yet reliable enough for widespread use
- But progress in recent months
- Heavy company investment

**BeTrace opportunity**:
- **Agent monitoring = greenfield**
- First-mover advantage
- Track: Plans → Actions → Outcomes
- Detect: Goal deviation, unsafe actions, hijacking attempts

---

## KEY IDEAS: Future Capabilities (1.3)

### Future Pace: "Slow to Extremely Rapid"

**Expert disagreement** on three questions:
1. Will scaling continue to work?
2. Can scaling overcome current limitations?
3. Will new breakthroughs occur?

**Scaling projections** (if trends continue):
- **100x more training compute by end of 2026** vs. 2023
- **10,000x more by 2030**
- Annual increases: ~4x compute, ~2.5x data
- **Inference scaling**: Also more compute at runtime (o1, R1)

**Bottlenecks that could slow progress**:
- Data availability (running out of internet text)
- AI chips (supply constrained)
- Capital (billions per model)
- Energy capacity (local grid constraints)

**But companies are "working to navigate" these bottlenecks**

### Inference Scaling = New Frontier

**Traditional scaling**: More compute during training
**Inference scaling**: More compute during use

**Benefits**:
- Overcome previous limitations
- Better reasoning on complex problems
- Write longer chains of thought
- Self-improvement loops

**Costs**:
- "Significantly more expensive to use"
- But costs dropping (DeepSeek R1 example)

**BeTrace implication**:
- More runtime compute = longer traces
- More observable reasoning steps
- But also more data to analyze
- Need efficient pattern matching

### Policymaker Challenge: Evidence Dilemma

**Report quote**:
> "There are various challenges for policymakers stemming from how general-purpose AI is developed. Risks and vulnerabilities can emerge at many points along the development and deployment process, making the most effective interventions difficult to pinpoint and prioritise. Advances in model development are also happening rapidly and are difficult to predict. This makes it difficult to articulate robust policy interventions that will age well with a rapidly evolving technology."

**Specific challenges**:
1. Risks emerge at multiple lifecycle stages
2. Advances rapid and unpredictable
3. Policies may become outdated quickly
4. Can't predict which interventions will be effective

**Example**: o1's reasoning approach requires "much greater computational resources at point of use, which presents new implications for long-term compute infrastructure planning"

**BeTrace positioning**:
- **Lifecycle-agnostic**: Monitors deployed systems regardless of how they were built
- **Adapts to capability changes**: Pattern library evolves with AI advances
- **Future-proof**: Works for current AI and next-generation systems

---

## CONNECTIONS TO BeTrace

### The 6-Stage Lifecycle = BeTrace's Position

**Stages 1-3** (Data, Pre-training, Fine-tuning):
- Upstream, internal to model developer
- BeTrace doesn't monitor these
- Compliance/provenance aspects relevant

**Stage 4** (System Integration):
- **WHERE BEHAVIOR EMERGES**
- Model + scaffolding + tools + filters
- BeTrace patterns defined here

**Stage 5** (Deployment):
- **WHERE BeTrace OPERATES**
- Production environment
- Real users, real data, real risks

**Stage 6** (Post-deployment Monitoring):
- **WHAT BeTrace PROVIDES**
- Report: "Cat-and-mouse game" of fixing issues
- BeTrace: Systematic behavioral observation

### System Integration = BeTrace's Value Prop

**Report emphasizes**: System ≠ Model
- GPT-4 (model) vs. ChatGPT (system)
- System = model + components
- Components = scaffolding, tools, filters, UI

**Testing challenge**:
- Can't test all combinations pre-deployment
- Integration creates emergent behaviors
- Scaffolding enables autonomous actions

**BeTrace solution**:
- **Observes integrated system**, not isolated model
- **Captures scaffolding effects** (tool use, web access, memory)
- **Detects emergent patterns** not present in model alone

### Chain-of-Thought = Traceable Reasoning

**o1 breakthrough** via chain-of-thought:
- Breaks problems into steps
- Solves step-by-step
- Generates intermediate reasoning

**BeTrace opportunity**:
- Each reasoning step = OpenTelemetry span
- Pattern match on reasoning chains
- Detect deviations: "Why did it approach problem this way?"
- Compliance: "Show me the reasoning that led to this decision"

**Example pattern**:
```
trace.has(reasoning.medical_diagnosis)
  and trace.has(reasoning.step.differential_diagnosis)
  and trace.has(reasoning.step.evidence_review)
  and trace.has(reasoning.step.confidence_assessment)
```

### Capability Measurement Challenge = BeTrace's Differentiator

**Report problem**:
- Capabilities hard to reliably measure
- Test performance ≠ real-world performance
- Success varies by prompt, context, tools

**Traditional approach**:
- Pre-deployment capability testing
- Benchmark scores
- Red-team exercises

**BeTrace approach**:
- **Production capability observation**
- What can AI actually do in your environment?
- Track capability emergence/drift over time
- Pattern violations = unexpected capability manifestation

### Agent Monitoring = First-Mover Opportunity

**Report status**:
- Heavy investment by all major companies
- Not yet reliable enough for widespread use
- But "progress in recent months"

**BeTrace timing**:
- **Now = perfect time to launch agent monitoring**
- Market forming, no incumbent solutions
- First-mover defines category

**Agent-specific patterns**:
- Multi-step plan execution
- Goal deviation detection
- Tool use authorization
- Delegation boundaries
- Agent-to-agent interaction

---

## ACTIONS FOR BeTrace

### Product Features (Based on This Section)

**1. "Lifecycle Stage Detection"**
- Auto-tag traces with lifecycle stage
- Compliance: "Show me all production deployment traces"
- Audit: "Prove this model version is the deployed one"

**2. "Chain-of-Thought Instrumentation"**
- OpenTelemetry semantic conventions for reasoning steps
- Pattern library for reasoning chains
- Detect reasoning deviations

**3. "System Integration Observability"**
- Track: Model version + scaffolding + tools + filters
- Correlate: Integration changes → behavior changes
- Alert: "System behavior changed after integration update"

**4. "Capability Drift Detection"**
- Baseline: What can this AI do in our environment?
- Monitor: Is it doing things it couldn't before?
- Alert: New capability manifestation

**5. "Agent Behavior Monitoring"** (HIGH PRIORITY)
- Plan → Action → Outcome tracing
- Goal deviation detection
- Multi-step operation patterns
- Delegation boundary enforcement

### Messaging Refinements

**Use report language**:
- "Post-deployment monitoring" (stage 6 of lifecycle)
- "System integration effects" (model + components)
- "Chain-of-thought reasoning" (o1-style approaches)
- "Capability measurement challenges" (test ≠ production)

**Sales pitch components**:

1. **"The Lifecycle Gap"**
   - "AI development has 6 stages. Stages 1-4 are inside companies. Stage 5-6 is where risk materializes. BeTrace monitors stages 5-6."

2. **"System vs. Model"**
   - "You can test a model, but you deploy a system. System = model + scaffolding + tools. BeTrace observes the full system."

3. **"Chain-of-Thought Observability"**
   - "o1-style reasoning creates step-by-step traces. BeTrace makes those traces auditable and verifiable."

4. **"Capability Drift"**
   - "Pre-deployment testing measures capabilities at a point in time. BeTrace detects when capabilities change in production."

### Content Strategy

**Blog: "The AI Lifecycle and Where Behavioral Assurance Fits"**
- Explain 6 stages (use report diagram)
- Show where different monitoring approaches work
- Position BeTrace at stages 5-6

**Technical Deep-Dive: "Tracing Chain-of-Thought Reasoning with OpenTelemetry"**
- How o1-style reasoning generates spans
- Pattern matching on reasoning chains
- Code examples with BeTrace SDK

**Whitepaper: "From Model Testing to System Monitoring: The Behavioral Assurance Gap"**
- Report insight: System ≠ Model
- Testing limitations
- Production monitoring requirements
- BeTrace architecture

**Demo Video: "Monitoring an AI Agent Planning a Multi-Step Task"**
- Show agent reasoning through problem
- Display trace with plan → actions → outcomes
- Demonstrate pattern violation detection

### Partnership Opportunities

**OpenTelemetry Project**:
- Propose semantic conventions for:
  - AI reasoning steps (chain-of-thought)
  - Agent actions (plan, delegate, tool-use)
  - Model lifecycle stages
  - System integration metadata

**AI Framework Integrations**:
- **LangChain**: Agent framework with tool use
- **AutoGPT**: Autonomous agent platform
- **LlamaIndex**: RAG + agent orchestration
- Add BeTrace instrumentation out-of-the-box

**Cloud AI Services**:
- **AWS Bedrock**: Agent runtime
- **Azure OpenAI**: Enterprise deployments
- **GCP Vertex AI**: Model deployment
- Built-in behavioral assurance

### Sales Discovery Questions

**On lifecycle**:
- "At what stage of the AI lifecycle do you currently assess risk?" (Listen for: pre-training, pre-deployment testing)
- "How do you monitor behavior after deployment?" (Listen for: logs, metrics, user complaints)
- "Who owns post-deployment monitoring in your org?" (Listen for: unclear ownership)

**On system vs. model**:
- "Do you test your AI in isolation or as an integrated system?" (Listen for: model-only testing)
- "How do scaffolding and tool access change your AI's behavior?" (Listen for: "We don't know")
- "Can you show me a trace of your AI system performing a task?" (Listen for: "We don't have that")

**On capabilities**:
- "How do you know what your AI can actually do in your environment?" (Listen for: benchmark scores, vendor claims)
- "Have you ever been surprised by what your AI could do?" (Listen for: yes!)
- "How would you detect if your AI's capabilities changed?" (Listen for: manual testing, incidents)

**On agents**:
- "Are you deploying or planning to deploy AI agents?" (Listen for: yes/soon/interested)
- "How will you monitor what your agents are doing autonomously?" (Listen for: "Good question")
- "What happens if an agent pursues the wrong goal?" (Listen for: "We'd have to manually check")

---

## KEY QUOTES FOR POSITIONING

### On System Integration
> "Developers combine one or more general-purpose AI models with other components such as user interfaces or content filters to create a full 'AI system' that is ready for use."

**BeTrace response**: "We monitor AI systems, not just models - capturing integration effects that pre-deployment testing misses."

### On Post-Deployment Monitoring
> "Developers gather and analyse user feedback, track impact and performance metrics, and make iterative improvements to address issues or limitations discovered during real-world use."

**BeTrace response**: "Traditional post-deployment monitoring is reactive (user feedback). Behavioral assurance is proactive (pattern detection)."

### On Capability Measurement
> "A general-purpose AI system's capabilities are difficult to reliably measure...their capability profiles differ significantly from those of humans."

**BeTrace response**: "Can't reliably measure capabilities pre-deployment. Must observe actual capabilities in production."

### On Future Advances
> "Advances in model development are also happening rapidly and are difficult to predict. This makes it difficult to articulate robust policy interventions that will age well with a rapidly evolving technology."

**BeTrace response**: "Behavioral assurance is future-proof - works regardless of how AI capabilities evolve. Patterns adapt, monitoring continues."

### On Chain-of-Thought
> "o1 employs 'chain of thought' problem-solving that breaks problems down into steps which are then solved bit-by-bit."

**BeTrace response**: "Chain-of-thought reasoning creates observable traces. BeTrace makes AI reasoning auditable."

---

## STRATEGIC INSIGHT

The report's lifecycle framework validates BeTrace's position:
- **Stages 1-4**: Inside AI companies (data, training, integration)
- **Stages 5-6**: Where AI meets reality (deployment, monitoring)

**Traditional AI safety focuses on stages 1-4**:
- Training data filtering
- Adversarial training
- Pre-deployment red-teaming

**BeTrace focuses on stages 5-6**:
- Production behavioral monitoring
- Real-world pattern detection
- Continuous capability observation

**This is not competitive** - it's complementary. BeTrace doesn't replace pre-deployment safety. It adds post-deployment assurance.

**The gap is real**: Report explicitly discusses stages 1-6 but most safety research focuses on 1-4. Stages 5-6 are under-resourced.

**BeTrace fills that gap.**
