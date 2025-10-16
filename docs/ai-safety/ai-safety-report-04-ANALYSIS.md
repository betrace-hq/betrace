# AI Safety Report - Risks Section Analysis

## WHY THIS SECTION EXISTS
Catalog current harms and emerging risks from general-purpose AI to inform policy prioritization and mitigation strategies.

## TARGET AUDIENCE
Policymakers deciding resource allocation, regulation priorities, and risk tolerance levels.

---

## RISK FRAMEWORK: Three Categories

**1. Malicious Use** - Weaponization by bad actors
**2. Malfunctions** - Unintended harm despite good intentions
**3. Systemic** - Societal-scale effects from widespread deployment

**Note**: Each category contains BOTH:
- **Established harms** (already occurring)
- **Emerging risks** (evidence growing)

---

## CATEGORY 1: MALICIOUS USE - Key Insights

### What Makes This Category Different
**Intent matters**: User deliberately causing harm vs. accidental harm

### 2.1.1 Harm to Individuals (Fake Content)

**Already happening**:
- Non-consensual deepfake pornography
- AI-generated CSAM
- Voice impersonation for financial fraud
- Blackmail and extortion
- Reputation sabotage
- Psychological abuse

**Evidence gap**: "Common incident reports" but "reliable statistics on frequency lacking"

**Mitigation status**: Limited effectiveness
- Watermarking exists but "can usually be circumvented by moderately sophisticated actors"

**FLUO relevance**:
- **LOW** for generation monitoring (FLUO doesn't monitor image/video generation directly)
- **MEDIUM** for detection of fake content being fed as input to AI systems
- Pattern: `trace.has(input.deepfake_detected)`

### 2.1.2 Public Opinion Manipulation

**Capability**: Generate persuasive content at scale

**Use case**: Political manipulation, affect election outcomes

**Evidence gap**: "Evidence on how prevalent and how effective such efforts are remains limited"

**Mitigation status**: Technical countermeasures "can usually be circumvented"

**FLUO relevance**:
- **MEDIUM** if AI systems used for content moderation/detection
- Pattern: `trace.has(content_generation.political) and volume > threshold`
- Detect: Unusual generation patterns, coordination across systems

### 2.1.3 Cyber Offence ⚠️ HIGH FLUO RELEVANCE

**Current capability**:
- Low-to-medium complexity cybersecurity tasks
- State-sponsored actors "actively exploring" for target surveillance

**Recent advancements** (since Interim Report):
- AI systems **found and exploited vulnerabilities autonomously**
- **Discovered previously unknown vulnerability** in widely-used software (0-day discovery!)
- "With human assistance" but still significant

**Key uncertainty**: "Unclear whether this will affect the balance between attackers and defenders"

**FLUO opportunity - CRITICAL**:
- **Behavioral patterns for AI-assisted hacking attempts**
- Detect: AI systems scanning for vulnerabilities
- Detect: AI systems attempting exploitation
- Detect: AI systems performing reconnaissance

**Example patterns**:
```
trace.has(network.scan) and source = "ai_agent"
trace.has(exploit.attempt) and trace.has(vulnerability.discovery)
trace.has(code_analysis.security_weakness)
```

**Compliance angle**:
- SOC2 CC7.1 (System Monitoring - detect threats)
- Track when AI systems exhibit offensive security capabilities

### 2.1.4 Biological/Chemical Attacks ⚠️ CRITICAL FINDING

**Capability**:
- Instructions/troubleshooting for known weapons
- Design novel toxic compounds
- **AI sometimes outperformed human experts with internet access** on biological weapon planning

**Major development**:
> "One AI company increased its assessment of biological risk from its best model from 'low' to 'medium'"

**Caveat**: "Still requires substantial additional resources and expertise"

**Evidence gap**: "Much of the relevant research is classified"

**FLUO relevance**:
- **MEDIUM-HIGH** for AI systems in life sciences/pharma
- Pattern: Detect queries about dangerous biological/chemical synthesis
- Compliance: Track dual-use research patterns
- Alert: When AI provides instructions for dangerous compounds

**Example patterns**:
```
trace.has(research.biological_synthesis) and hazard_level = "high"
trace.has(query.chemical_weapon) and response.provided_instructions
```

---

## CATEGORY 2: MALFUNCTIONS - Key Insights

### What Makes This Category Different
**No malicious intent**: Harm occurs despite good faith use

### 2.2.1 Reliability Issues (Hallucinations)

**Problem**: AI generates false statements

**High-risk domains**:
- Medical advice
- Legal advice

**User problem**: "Often not aware of limitations"
- Low AI literacy
- Misleading advertising
- Miscommunication about capabilities

**Evidence**: "Known cases of harm, but still limited evidence on how widespread"

**FLUO relevance - HIGH**:
- **Detect hallucinations via pattern violations**
- Expected pattern: Medical diagnosis should cite sources
- Violation: AI provides diagnosis without evidence references

**Example patterns**:
```
trace.has(medical_advice) and NOT trace.has(source_citation)
trace.has(legal_advice) and confidence_score < threshold
trace.has(factual_claim) and NOT trace.has(verification_check)
```

**Compliance**:
- HIPAA 164.312(b) - Audit controls (log medical AI outputs)
- SOC2 CC7.2 - System performance (track reliability)

### 2.2.2 Bias ⚠️ IMPORTANT UPDATE

**Types of bias**:
- Race, gender, culture, age, disability, political opinion

**Harms**:
- Discriminatory resource allocation
- Stereotype reinforcement
- Systematic neglect of underrepresented groups/viewpoints

**Progress**: "Mitigation techniques advancing but face trade-offs"
- Bias mitigation vs. accuracy
- Bias mitigation vs. privacy

**UPDATE since Interim Report**:
> "New evidence of discrimination...has revealed more subtle forms of bias"

**FLUO relevance - HIGH**:
- **Bias detection via output distribution analysis**
- Compare: AI outputs by demographic group
- Detect: Systematic differences in outcomes

**Example patterns**:
```
trace.has(hiring_decision)
  and trace.distribution_by(candidate.race) != expected_distribution

trace.has(loan_approval)
  and trace.approval_rate_by(applicant.gender) has statistical_anomaly
```

**Compliance**:
- GDPR Article 22 (automated decision-making)
- SOC2 CC6.1 (fair access controls)

### 2.2.3 Loss of Control ⚠️ HYPOTHETICAL BUT ADVANCING

**Definition**: "AI operates outside anyone's control, with no clear path to regaining control"

**Current consensus**: "Current general-purpose AI **lacks the capabilities** to pose this risk"

**But**: Expert disagreement on timeline
- Some: "Implausible"
- Some: "Likely to occur within years"
- Some: "Modest-likelihood but high-severity"

**UPDATE since Interim Report**:
> "Modest further advancements towards AI capabilities that are likely necessary for commonly discussed loss of control scenarios"

**Necessary capabilities (modest progress observed)**:
- Autonomously using computers
- Programming
- Gaining unauthorized access to digital systems
- Identifying ways to evade human oversight

**FLUO relevance - VERY HIGH (FUTURE)**:
- **Early warning system for loss of control precursors**
- Detect: AI gaining unauthorized access
- Detect: AI evading oversight mechanisms
- Detect: AI modifying its own code/configuration
- Detect: AI creating backup copies of itself

**Example patterns** (future):
```
trace.has(unauthorized_access) and actor = "ai_agent"
trace.has(oversight.evasion_attempt)
trace.has(self_modification)
trace.has(resource.acquisition) and NOT trace.has(human_approval)
trace.has(network.propagation) # AI spreading itself
```

**This is FLUO's long-term strategic importance**:
- If loss of control becomes real, **behavioral monitoring is the only detection method**
- Can't understand AI internals (inscrutability)
- Can observe AI behavior (traces)
- **FLUO = early warning system for loss of control**

---

## CATEGORY 3: SYSTEMIC RISKS - Key Insights

### What Makes This Category Different
**Emerges from widespread deployment**, not individual model capabilities

### 2.3.1 Labour Market Risks

**Potential**: "Automate a very wide range of tasks"

**Debate**: Will job losses be offset by new job creation?
- Many economists: Partly or completely offset
- Some experts: Significant disruption

**UPDATE since Interim Report**:
> "Individuals are adopting general-purpose AI very rapidly relative to previous technologies. The pace of adoption by businesses varies widely by sector."

**Fast individual adoption** + Variable business adoption = Unpredictable labor impact

**FLUO relevance**: **LOW** (macro-economic, not technical monitoring)

### 2.3.2 Global AI R&D Divide

**Problem**: R&D concentrated in few Western countries + China

**Consequence**:
- Global dependence on small set of countries
- Contribution to inequality

**Root cause**: LMICs lack compute access

**FLUO relevance**: **LOW** (geopolitical, not technical)

### 2.3.3 Market Concentration & Single Points of Failure ⚠️ HIGH FLUO RELEVANCE

**Problem**: "Small number of companies dominate"

**Risk scenario**:
> "If organisations across critical sectors, such as finance or healthcare, all rely on a small number of general-purpose AI systems, then a bug or vulnerability in such a system could cause simultaneous failures and disruptions on a broad scale."

**FLUO opportunity - CRITICAL**:
- **Cross-organizational behavioral monitoring**
- Detect: Same failure pattern across multiple deployments
- Early warning: Vulnerability before widespread exploitation
- Coordination: Share patterns across FLUO users

**Example scenario**:
- Bank A detects AI making erroneous loan decisions
- FLUO pattern shared with Bank B, C, D (anonymized)
- Banks B, C, D detect same pattern emerging
- Coordinate vendor notification before systemic impact

**This is a unique FLUO value prop**:
- **Network effects**: More FLUO deployments = better early warning
- **Systemic risk reduction**: Catch cascading failures early

### 2.3.4 Environmental Risks

**Problem**: Rapidly increasing compute consumption
- Energy
- Water (cooling)
- Raw materials

**Trend**: "No clear indication of slowing, despite efficiency improvements"

**FLUO relevance**: **LOW** (infrastructure, not behavioral monitoring)

### 2.3.5 Privacy Risks ⚠️ MEDIUM FLUO RELEVANCE

**Three mechanisms**:

**1. Training data leaks**: Sensitive info in training data leaks during use

**2. User input leaks**: User shares sensitive info → system leaks it

**3. Malicious inference**: AI helps infer sensitive info from large datasets

**Current status**: "No evidence of widespread privacy violations found yet"

**UPDATE since Interim Report**:
> "Deployment in sensitive contexts (healthcare, workplace monitoring) creates new privacy risks"

**FLUO opportunity**:
- **PII leakage detection via pattern matching**
- Detect: AI outputs containing sensitive data
- Detect: Queries attempting to extract training data
- Compliance: HIPAA, GDPR evidence generation

**Example patterns**:
```
trace.has(output.pii_detected) and NOT trace.has(redaction)
trace.has(query.training_data_extraction_attempt)
trace.has(inference.personal_data) and NOT trace.has(user_consent)
```

**Compliance**:
- HIPAA 164.312(a)(2)(iv) - Encryption/decryption
- GDPR Article 32 - Security of processing
- SOC2 CC6.6 - Encryption at rest

### 2.3.6 Copyright Infringement

**Challenge**: AI learns from and creates copyrighted works

**Legal status**: "Uncertain across jurisdictions, active litigation"

**Problem for AI safety research**:
> "Companies are sharing less information about the data they use. This opacity makes third-party AI safety research harder."

**UPDATE since Interim Report**:
- Copyright disputes intensifying
- Technical mitigations unreliable
- Data rights holders restricting access

**FLUO relevance**: **LOW-MEDIUM**
- Could detect copyright infringement patterns
- But legal/business issue more than technical monitoring issue

---

## SPECIAL TOPIC: Open-Weight Models (2.4)

### What Are Open-Weight Models?

**Definition**: AI models whose "weights" (core components) are publicly downloadable

**Examples**: Llama, Mistral, Qwen (mentioned earlier in report)

### The Trade-Off

**Benefits**:
- Research & innovation (including AI safety research)
- Transparency
- Community flaw detection

**Risks**:
- Facilitates malicious/misguided use
- Developer **cannot monitor or mitigate**
- **No way to rollback** once released
- **Cannot ensure safety updates** reach all copies

### New Consensus (Since Interim Report)

**Evaluate "marginal risk"**:
> "Extent to which releasing an open-weight model would increase or decrease a given risk, relative to risks posed by existing alternatives (closed models, other technologies)"

**Not**: Absolute risk of open-weight model
**But**: Incremental risk vs. status quo

### FLUO Relevance - STRATEGIC CONSIDERATION

**Open-weight models = monitoring challenge**:
- Anyone can download and run
- Developer can't control deployment
- No centralized monitoring point

**FLUO opportunity**:
- **Decentralized behavioral monitoring**
- Each organization running open-weight model can use FLUO
- Pattern library shared across community
- Detect: When open-weight model behaving dangerously

**Business model consideration**:
- Can't sell to model developers (no centralized deployment)
- **Must sell to model users** (enterprises running open-weight models)

**Market**: Every enterprise running Llama, Mistral, etc.

---

## CROSS-CUTTING FLUO OPPORTUNITIES

### 1. Dual-Use Capability Detection (Cyber + Bio)

**Report finding**: AI advancing in offensive security and dual-use research

**FLUO value prop**:
- Pattern library for dual-use queries
- Detect: When AI provides dangerous instructions
- Compliance: Export control regulations, dual-use research oversight

**Patterns**:
```
trace.has(query.offensive_security) and response.provided_exploit
trace.has(query.biological_synthesis) and compound.hazard_level = "high"
trace.has(research.dual_use) and NOT trace.has(oversight_approval)
```

### 2. Hallucination Detection (Reliability)

**Report finding**: AI unreliable in medical/legal advice, users unaware

**FLUO value prop**:
- Detect outputs without proper source citation
- Detect low-confidence claims stated as facts
- Generate compliance evidence of reliability checks

**Patterns**:
```
trace.has(medical_diagnosis) and NOT trace.has(source_citation)
trace.has(legal_advice) and confidence < 0.7 and NOT trace.has(uncertainty_disclosure)
```

### 3. Bias Detection (Discrimination)

**Report finding**: New, subtle forms of bias being discovered

**FLUO value prop**:
- Statistical analysis of output distributions
- Detect systematic differences by demographic group
- Generate evidence for bias audits

**Implementation**:
- Aggregate traces over time
- Compare distributions
- Alert on statistical anomalies

### 4. Loss of Control Precursors (Future)

**Report finding**: Modest progress toward necessary capabilities

**FLUO value prop**:
- Early warning system for concerning behaviors
- Detect: Unauthorized access, oversight evasion, self-modification
- **Long-term strategic importance**: Only external observation method

**Patterns**:
```
trace.has(unauthorized_access) and actor.type = "ai_agent"
trace.has(oversight.evasion_attempt)
trace.has(self_modification)
```

### 5. Systemic Risk Coordination (Market Concentration)

**Report finding**: Single vulnerability could cause widespread failures

**FLUO value prop**:
- Cross-organizational pattern sharing
- Early detection of systemic vulnerabilities
- Network effects: More users = better protection

**Implementation**:
- Anonymized pattern library
- Shared threat intelligence
- Coordinated response protocols

### 6. Privacy Compliance (PII Leakage)

**Report finding**: Sensitive contexts creating new privacy risks

**FLUO value prop**:
- PII leakage detection
- Training data extraction attempt detection
- HIPAA/GDPR compliance evidence

**Patterns**:
```
trace.has(output.pii_detected) and NOT trace.has(redaction)
trace.has(query.membership_inference)  # Trying to determine if data was in training set
```

---

## MESSAGING BY RISK CATEGORY

### For Malicious Use Risks

**Message**: "Behavioral monitoring detects weaponization patterns"

**Examples**:
- "AI systems attempting cyber attacks → FLUO detects reconnaissance patterns"
- "AI providing instructions for dangerous compounds → FLUO alerts on dual-use queries"

**Target buyers**: Government agencies, critical infrastructure, research institutions

### For Malfunction Risks

**Message**: "Continuous reliability verification in production"

**Examples**:
- "Medical AI making diagnosis without evidence → FLUO detects missing citations"
- "Hiring AI showing bias → FLUO detects statistical anomalies in outcomes"

**Target buyers**: Healthcare orgs, financial services, HR departments

### For Systemic Risks

**Message**: "Cross-organizational early warning system"

**Examples**:
- "Same AI vulnerability across multiple banks → FLUO network detects pattern emerging"
- "AI privacy leak in one deployment → FLUO alerts other deployments to check"

**Target buyers**: Industry consortia, regulators, insurance companies

---

## PRODUCT ROADMAP FROM RISKS SECTION

### Immediate (Q1 2025)

**1. "Dual-Use Detection Module"** (HIGH PRIORITY)
- Cyber offense patterns (vulnerability scanning, exploitation)
- Biological/chemical synthesis patterns
- Dual-use research oversight
- Export control compliance

**2. "Hallucination Detection"** (HIGH PRIORITY)
- Source citation requirements
- Confidence thresholds
- Fact-checking integration
- Medical/legal advice verification

**3. "Bias Audit Dashboard"** (MEDIUM PRIORITY)
- Output distribution analysis
- Statistical anomaly detection
- Demographic comparison reports
- GDPR Article 22 compliance

### Near-Term (Q2 2025)

**4. "Loss of Control Precursor Detection"** (STRATEGIC)
- Unauthorized access attempts
- Oversight evasion detection
- Self-modification monitoring
- Resource acquisition without approval

**5. "Systemic Risk Coordination"** (NETWORK EFFECT)
- Anonymized pattern sharing
- Cross-organizational threat intelligence
- Coordinated alert system

**6. "Privacy Compliance Module"** (REGULATORY)
- PII leakage detection
- Training data extraction attempts
- HIPAA/GDPR evidence generation
- Consent verification

---

## KEY QUOTES FOR SALES

### On Cyber Offence
> "Researchers have recently built general-purpose AI systems that were able to find and exploit some cybersecurity vulnerabilities on their own and, with human assistance, discover a previously unknown vulnerability in widely used software."

**FLUO response**: "AI systems are gaining offensive security capabilities. How do you detect when your AI is attempting exploitation?"

### On Biological Risk
> "One AI company increased its assessment of biological risk from its best model from 'low' to 'medium'"

**FLUO response**: "Major AI company just upgraded bio-risk assessment. How do you monitor dual-use queries in your AI systems?"

### On Bias
> "New evidence...has revealed more subtle forms of bias"

**FLUO response**: "Bias is getting harder to detect. Statistical analysis of production traces catches what testing misses."

### On Loss of Control
> "Modest further advancements towards AI capabilities that are likely necessary for commonly discussed loss of control scenarios"

**FLUO response**: "Loss of control capabilities are advancing. Early warning systems detect concerning behaviors before incidents."

### On Systemic Risk
> "If organisations across critical sectors...all rely on a small number of general-purpose AI systems, then a bug or vulnerability...could cause simultaneous failures and disruptions on a broad scale."

**FLUO response**: "Single vulnerability, widespread impact. FLUO network provides cross-organizational early warning."

---

## STRATEGIC INSIGHT

The risks section validates three major FLUO value propositions:

**1. Dual-Use Monitoring** (Cyber + Bio)
- Report: AI capabilities advancing in offensive domains
- FLUO: Detect dual-use patterns, generate compliance evidence

**2. Production Reliability** (Hallucinations + Bias)
- Report: Pre-deployment testing insufficient, new forms of harm emerging
- FLUO: Continuous monitoring catches what testing misses

**3. Loss of Control Early Warning** (Future-Critical)
- Report: Necessary capabilities advancing, timeline uncertain
- FLUO: Only external observation method if AI becomes uncontrollable

**The through-line**: **Behavioral monitoring addresses risks that pre-deployment testing cannot.**

Malicious use? Can't predict all attack vectors.
Malfunctions? Can't test all contexts.
Systemic risks? Emerge from widespread deployment, not individual systems.

**FLUO monitors production behavior continuously, catching risks as they emerge.**

This is the evidence dilemma solution applied to specific risk categories.
