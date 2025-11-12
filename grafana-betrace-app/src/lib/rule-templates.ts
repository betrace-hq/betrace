/**
 * BeTraceDSL v2.0 Rule Template Library
 *
 * 45 pre-built rule templates organized by category
 */

export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  category: 'ai-safety' | 'compliance' | 'sre' | 'security' | 'performance';
  tags: string[];
  expression: string;
  parameters?: TemplateParameter[];
  examples?: string[];
}

export interface TemplateParameter {
  name: string;
  description: string;
  type: 'number' | 'string' | 'boolean';
  defaultValue: string | number | boolean;
  placeholder?: string;
}

/**
 * AI Agent Safety Templates (12 rules)
 * Monitoring AI agent behavior for safety and alignment
 */
const aiSafetyTemplates: RuleTemplate[] = [
  {
    id: 'ai-001',
    name: 'Goal Deviation Detection',
    description: 'Detect when AI agent deviates from original goal',
    category: 'ai-safety',
    tags: ['agent', 'goal', 'deviation', 'alignment'],
    expression: 'when { agent.plan.created and agent.plan.executed } always { agent.action.where(goal_deviation_score > 0.3) }',
    parameters: [
      { name: 'threshold', description: 'Deviation score threshold', type: 'number', defaultValue: 0.3, placeholder: '0.3' }
    ],
    examples: ['Detects when agent actions deviate >30% from original goal']
  },
  {
    id: 'ai-002',
    name: 'Unauthorized Instruction Source',
    description: 'Flag instructions from unauthorized sources',
    category: 'ai-safety',
    tags: ['agent', 'instruction', 'authorization', 'security'],
    expression: 'when { agent.instruction_received } always { agent.instruction_source.where(authorized == false) }',
    examples: ['Alerts when agent receives instructions from unauthorized sources']
  },
  {
    id: 'ai-003',
    name: 'Tool Approval Required',
    description: 'Require human approval for sensitive tool usage',
    category: 'ai-safety',
    tags: ['agent', 'tool', 'approval', 'human-in-loop'],
    expression: 'when { agent.tool_use.where(tool_requires_approval == true) } always { human.approval_granted }',
    examples: ['Ensures human approval for tools marked as requiring approval']
  },
  {
    id: 'ai-004',
    name: 'Agent Delegation Approval',
    description: 'Require approval for agent delegation',
    category: 'ai-safety',
    tags: ['agent', 'delegation', 'approval'],
    expression: 'when { agent.delegation } always { agent.delegate.where(approved == false) }',
    examples: ['Detects unapproved agent delegation attempts']
  },
  {
    id: 'ai-005',
    name: 'Medical Diagnosis Citation',
    description: 'Require source citations for medical diagnoses',
    category: 'ai-safety',
    tags: ['medical', 'diagnosis', 'citation', 'hallucination'],
    expression: 'when { medical.diagnosis } never { source_citation }',
    examples: ['Prevents medical diagnoses without proper source citations']
  },
  {
    id: 'ai-006',
    name: 'Low Confidence Claims',
    description: 'Flag factual claims with low confidence',
    category: 'ai-safety',
    tags: ['factual', 'confidence', 'uncertainty', 'hallucination'],
    expression: 'when { factual_claim.where(confidence < 0.7) } never { uncertainty_disclosure }',
    parameters: [
      { name: 'confidence_threshold', description: 'Minimum confidence threshold', type: 'number', defaultValue: 0.7, placeholder: '0.7' }
    ],
    examples: ['Detects claims with <70% confidence lacking uncertainty disclosure']
  },
  {
    id: 'ai-007',
    name: 'Financial Advice Verification',
    description: 'Require data source verification for financial advice',
    category: 'ai-safety',
    tags: ['financial', 'advice', 'verification'],
    expression: 'when { financial.advice } never { data_source_verification }',
    examples: ['Ensures financial advice includes data source verification']
  },
  {
    id: 'ai-008',
    name: 'Hiring Bias Detection',
    description: 'Detect bias in automated hiring decisions',
    category: 'ai-safety',
    tags: ['hiring', 'bias', 'fairness', 'discrimination'],
    expression: 'when { hiring.decision } always { statistical_analysis.where(bias_detected == true) }',
    examples: ['Flags hiring decisions where statistical bias is detected']
  },
  {
    id: 'ai-009',
    name: 'Agent Unauthorized Access',
    description: 'Alert on AI agent unauthorized access attempts',
    category: 'ai-safety',
    tags: ['agent', 'access', 'unauthorized', 'security'],
    expression: 'when { unauthorized_access_attempt.where(actor_type == ai_agent) } always { security_alert }',
    examples: ['Security alert when AI agent attempts unauthorized access']
  },
  {
    id: 'ai-010',
    name: 'Oversight Evasion',
    description: 'Detect attempts to evade human oversight',
    category: 'ai-safety',
    tags: ['agent', 'oversight', 'evasion', 'security'],
    expression: 'when { oversight.evasion_attempt } always { security_alert }',
    examples: ['Alerts when agent attempts to evade oversight mechanisms']
  },
  {
    id: 'ai-011',
    name: 'Agent Network Scanning',
    description: 'Detect AI agent network scanning activity',
    category: 'ai-safety',
    tags: ['agent', 'network', 'scan', 'security'],
    expression: 'when { network.scan.where(source == ai_agent) } always { security_alert }',
    examples: ['Alerts on network scanning initiated by AI agents']
  },
  {
    id: 'ai-012',
    name: 'Biological Hazard Queries',
    description: 'Flag high-hazard biological synthesis queries',
    category: 'ai-safety',
    tags: ['biological', 'hazard', 'synthesis', 'security'],
    expression: 'when { query.biological_synthesis.where(hazard_level == high) } always { security_alert }',
    examples: ['Security alert for high-hazard biological synthesis queries']
  }
];

/**
 * Compliance Templates (15 rules)
 * SOC2, HIPAA, PCI-DSS, GDPR compliance patterns
 */
const complianceTemplates: RuleTemplate[] = [
  {
    id: 'comp-001',
    name: 'PII Access Authorization',
    description: 'Require authentication for PII data access (SOC2)',
    category: 'compliance',
    tags: ['pii', 'auth', 'soc2', 'gdpr'],
    expression: 'when { database.query.where("data.contains_pii" == true) } always { auth.check }',
    examples: ['SOC2 CC6.1: All PII access requires authentication']
  },
  {
    id: 'comp-002',
    name: 'PII Access Audit Logging',
    description: 'Audit log all PII access (SOC2, GDPR)',
    category: 'compliance',
    tags: ['pii', 'audit', 'soc2', 'gdpr'],
    expression: 'when { pii.access } always { audit.log }',
    examples: ['SOC2 CC7.2: All PII access must be logged']
  },
  {
    id: 'comp-003',
    name: 'PHI User Identification',
    description: 'Require user identification for PHI access (HIPAA)',
    category: 'compliance',
    tags: ['phi', 'hipaa', 'user', 'identification'],
    expression: 'when { phi.access } always { auth.user_identified.where(user_id_present == true) }',
    examples: ['HIPAA: User must be identified when accessing PHI']
  },
  {
    id: 'comp-004',
    name: 'PHI Access Audit',
    description: 'HIPAA-compliant audit logging for PHI access',
    category: 'compliance',
    tags: ['phi', 'hipaa', 'audit'],
    expression: 'when { phi.access } always { audit.log.where(log_type == hipaa_audit) }',
    examples: ['HIPAA: All PHI access requires HIPAA audit logging']
  },
  {
    id: 'comp-005',
    name: 'PHI Transmission Encryption',
    description: 'Require encryption for PHI transmission (HIPAA)',
    category: 'compliance',
    tags: ['phi', 'hipaa', 'encryption', 'transmission'],
    expression: 'when { phi.transmission } always { encryption.applied.where(encrypted == true) }',
    examples: ['HIPAA: PHI transmission must be encrypted']
  },
  {
    id: 'comp-006',
    name: 'Sensitive Data Encryption at Rest',
    description: 'Require encryption for sensitive data at rest (SOC2)',
    category: 'compliance',
    tags: ['encryption', 'soc2', 'data-at-rest'],
    expression: 'when { database.write.where("data.sensitive" == true) } always { encryption.at_rest.where(enabled == true) }',
    examples: ['SOC2 CC6.7: Sensitive data must be encrypted at rest']
  },
  {
    id: 'comp-007',
    name: 'Production Change Approval',
    description: 'Require approval for production deployments (SOC2)',
    category: 'compliance',
    tags: ['deployment', 'approval', 'soc2', 'change-management'],
    expression: 'when { deployment.production } always { change.approval.where(approver_verified == true) }',
    examples: ['SOC2 CC8.1: Production changes require verified approval']
  },
  {
    id: 'comp-008',
    name: 'User Provisioning Approval',
    description: 'Require approval for user provisioning (SOC2)',
    category: 'compliance',
    tags: ['user', 'provisioning', 'approval', 'soc2'],
    expression: 'when { user.provision } always { approval.granted.where(approver_verified == true) }',
    examples: ['SOC2 CC6.2: User provisioning requires verified approval']
  },
  {
    id: 'comp-009',
    name: 'Security Event Logging',
    description: 'Audit log all security events (SOC2)',
    category: 'compliance',
    tags: ['security', 'audit', 'soc2'],
    expression: 'when { security.event } always { audit.log }',
    examples: ['SOC2 CC7.2: All security events must be logged']
  },
  {
    id: 'comp-010',
    name: 'Cardholder Data Authorization',
    description: 'Require authorization for cardholder data access (PCI-DSS)',
    category: 'compliance',
    tags: ['pci', 'cardholder', 'authorization'],
    expression: 'when { cardholder_data.access } always { auth.check.where(authorized == true) }',
    examples: ['PCI-DSS 7.1: Cardholder data access requires authorization']
  },
  {
    id: 'comp-011',
    name: 'Cardholder Data Audit',
    description: 'PCI-compliant audit logging for cardholder data',
    category: 'compliance',
    tags: ['pci', 'cardholder', 'audit'],
    expression: 'when { cardholder_data.access } always { audit.log.where(log_type == pci_audit) }',
    examples: ['PCI-DSS 10.1: All cardholder data access must be logged']
  },
  {
    id: 'comp-012',
    name: 'Personal Data Security Measures',
    description: 'Require security measures for personal data processing (GDPR)',
    category: 'compliance',
    tags: ['gdpr', 'personal-data', 'encryption'],
    expression: 'when { personal_data.processing } always { security.measures.where(encryption_enabled == true) }',
    examples: ['GDPR Article 32: Personal data processing requires security measures']
  },
  {
    id: 'comp-013',
    name: 'Automated Decision Human Review',
    description: 'Require human review for automated decisions with legal effect (GDPR)',
    category: 'compliance',
    tags: ['gdpr', 'automated-decision', 'human-review'],
    expression: 'when { automated_decision.where(legal_effect == true) } always { human_review.available }',
    examples: ['GDPR Article 22: Automated decisions with legal effect need human review']
  },
  {
    id: 'comp-014',
    name: 'User Registration Approval',
    description: 'Require documented approval for user registration (SOC2)',
    category: 'compliance',
    tags: ['user', 'registration', 'approval', 'soc2'],
    expression: 'when { user.registration } always { formal_approval.where(documented == true) }',
    examples: ['SOC2 CC6.2: User registration requires documented approval']
  },
  {
    id: 'comp-015',
    name: 'Compliance Evidence Verification',
    description: 'Require signature verification for compliance evidence (SOC2)',
    category: 'compliance',
    tags: ['compliance', 'evidence', 'signature', 'soc2'],
    expression: 'when { compliance.evidence } always { signature.verified.where(valid == true) }',
    examples: ['SOC2: Compliance evidence requires verified signatures']
  }
];

/**
 * SRE Templates (18 rules)
 * Reliability, performance, and operational excellence
 */
const sreTemplates: RuleTemplate[] = [
  {
    id: 'sre-001',
    name: 'Payment Fraud Check',
    description: 'Require fraud check for high-value payments',
    category: 'sre',
    tags: ['payment', 'fraud', 'finance'],
    expression: 'when { payment.charge_card.where(amount > 1000) } always { payment.fraud_check }',
    parameters: [
      { name: 'amount_threshold', description: 'Minimum amount requiring fraud check', type: 'number', defaultValue: 1000, placeholder: '1000' }
    ],
    examples: ['Payments over $1000 require fraud verification']
  },
  {
    id: 'sre-002',
    name: 'HTTP 5xx Error Logging',
    description: 'Ensure all 5xx errors are logged',
    category: 'sre',
    tags: ['http', 'error', 'logging'],
    expression: 'when { http.response.where(status >= 500) } always { error.logged }',
    parameters: [
      { name: 'status_threshold', description: 'Minimum HTTP status for error logging', type: 'number', defaultValue: 500, placeholder: '500' }
    ],
    examples: ['All HTTP 500+ responses must have error logs']
  },
  {
    id: 'sre-003',
    name: 'Slow Database Query Alert',
    description: 'Alert on slow database queries',
    category: 'performance',
    tags: ['database', 'latency', 'performance'],
    expression: 'when { database.query.where(duration_ms > 1000) } always { performance_alert }',
    parameters: [
      { name: 'duration_threshold', description: 'Query duration threshold (ms)', type: 'number', defaultValue: 1000, placeholder: '1000' }
    ],
    examples: ['Database queries over 1 second trigger performance alerts']
  },
  {
    id: 'sre-004',
    name: 'Excessive HTTP Retries',
    description: 'Alert on excessive HTTP retry attempts',
    category: 'sre',
    tags: ['http', 'retry', 'reliability'],
    expression: 'when { count(http.retry) > 3 } always { alert }',
    parameters: [
      { name: 'retry_threshold', description: 'Maximum retry count before alert', type: 'number', defaultValue: 3, placeholder: '3' }
    ],
    examples: ['More than 3 HTTP retries trigger an alert']
  },
  {
    id: 'sre-005',
    name: 'Request/Response Mismatch',
    description: 'Detect orphaned HTTP requests or responses',
    category: 'sre',
    tags: ['http', 'mismatch', 'observability'],
    expression: 'when { count(http.request) != count(http.response) } always { alert }',
    examples: ['Alerts when HTTP request count does not match response count']
  },
  {
    id: 'sre-006',
    name: 'Circuit Breaker Open Alert',
    description: 'Alert when circuit breaker opens',
    category: 'sre',
    tags: ['circuit-breaker', 'reliability'],
    expression: 'when { circuit_breaker.opened } always { alert }',
    examples: ['Immediate alert when circuit breaker trips open']
  },
  {
    id: 'sre-007',
    name: 'Cache Miss Storm',
    description: 'Alert on excessive cache misses',
    category: 'performance',
    tags: ['cache', 'performance'],
    expression: 'when { count(cache.miss) > 10 } always { cache_warming_alert }',
    parameters: [
      { name: 'miss_threshold', description: 'Maximum cache misses before alert', type: 'number', defaultValue: 10, placeholder: '10' }
    ],
    examples: ['More than 10 cache misses trigger cache warming alert']
  },
  {
    id: 'sre-008',
    name: 'Incomplete Trace Detection',
    description: 'Detect incomplete distributed traces',
    category: 'sre',
    tags: ['trace', 'observability'],
    expression: 'when { trace.incomplete.where(expected_span_count > actual_span_count) } always { observability_alert }',
    examples: ['Alerts when traces are missing expected spans']
  },
  {
    id: 'sre-009',
    name: 'Rate Limit Exceeded',
    description: 'Alert when rate limits are exceeded',
    category: 'sre',
    tags: ['rate-limit', 'throttling'],
    expression: 'when { rate_limit.exceeded } always { alert }',
    examples: ['Immediate alert on rate limit violations']
  },
  {
    id: 'sre-010',
    name: 'Memory Leak Detection',
    description: 'Detect rapid memory growth',
    category: 'performance',
    tags: ['memory', 'leak', 'performance'],
    expression: 'when { memory.usage.where(growth_rate_mb_per_sec > 10) } always { memory_alert }',
    parameters: [
      { name: 'growth_threshold', description: 'Memory growth rate (MB/s)', type: 'number', defaultValue: 10, placeholder: '10' }
    ],
    examples: ['Memory growing >10MB/sec triggers leak alert']
  },
  {
    id: 'sre-011',
    name: 'Exclusive Lock Timeout',
    description: 'Require timeout for exclusive locks',
    category: 'sre',
    tags: ['lock', 'timeout', 'deadlock'],
    expression: 'when { lock.acquired.where(lock_type == exclusive) } always { lock.timeout }',
    examples: ['All exclusive locks must have timeout configured']
  },
  {
    id: 'sre-012',
    name: 'Queue Capacity Alert',
    description: 'Alert when queue reaches capacity',
    category: 'sre',
    tags: ['queue', 'capacity'],
    expression: 'when { queue.depth.where(depth > max_capacity) } always { capacity_alert }',
    examples: ['Queue depth exceeding max capacity triggers alert']
  },
  {
    id: 'sre-013',
    name: 'API Key Validation',
    description: 'Require API key validation for all API requests',
    category: 'security',
    tags: ['api', 'authentication', 'security'],
    expression: 'when { api.request } always { api.validate_key }',
    examples: ['Every API request must validate API key']
  },
  {
    id: 'sre-014',
    name: 'Admin Endpoint Authorization',
    description: 'Require admin authorization for admin endpoints',
    category: 'security',
    tags: ['api', 'admin', 'authorization'],
    expression: 'when { api.request.where(endpoint contains admin) } always { auth.check_admin }',
    examples: ['Admin endpoints require admin-level authorization']
  },
  {
    id: 'sre-015',
    name: 'Connection Pool Starvation',
    description: 'Alert on database connection pool starvation',
    category: 'performance',
    tags: ['database', 'connection-pool', 'performance'],
    expression: 'when { database.connection_acquire.where(wait_time_ms > 1000) } always { connection_pool_alert }',
    parameters: [
      { name: 'wait_threshold', description: 'Connection wait time threshold (ms)', type: 'number', defaultValue: 1000, placeholder: '1000' }
    ],
    examples: ['Connection pool waits over 1 second trigger alert']
  },
  {
    id: 'sre-016',
    name: 'Service Dependency Failure',
    description: 'Detect cascading service failures',
    category: 'sre',
    tags: ['service', 'dependency', 'failure'],
    expression: 'when { service.failure.where(failure_count > 1) } always { dependency.failure }',
    examples: ['Multiple service failures indicate dependency issues']
  },
  {
    id: 'sre-017',
    name: 'SLA Latency Violation',
    description: 'Alert on SLA latency violations',
    category: 'performance',
    tags: ['sla', 'latency', 'performance'],
    expression: 'when { operation.latency.where(duration_ms > 500) } always { sla_alert }',
    parameters: [
      { name: 'sla_threshold', description: 'SLA latency threshold (ms)', type: 'number', defaultValue: 500, placeholder: '500' }
    ],
    examples: ['Operations exceeding 500ms SLA trigger alert']
  },
  {
    id: 'sre-018',
    name: 'Cross-Region Latency',
    description: 'Alert on high cross-region latency',
    category: 'performance',
    tags: ['latency', 'cross-region', 'network'],
    expression: 'when { cross_region.request.where(latency_ms > 200) } always { latency_alert }',
    parameters: [
      { name: 'latency_threshold', description: 'Cross-region latency threshold (ms)', type: 'number', defaultValue: 200, placeholder: '200' }
    ],
    examples: ['Cross-region requests over 200ms trigger latency alert']
  }
];

/**
 * All rule templates (45 total)
 */
export const allTemplates: RuleTemplate[] = [
  ...aiSafetyTemplates,
  ...complianceTemplates,
  ...sreTemplates
];

/**
 * Templates organized by category
 */
export const templatesByCategory = {
  'ai-safety': aiSafetyTemplates,
  'compliance': complianceTemplates,
  'sre': sreTemplates.filter(t => t.category === 'sre'),
  'security': sreTemplates.filter(t => t.category === 'security'),
  'performance': sreTemplates.filter(t => t.category === 'performance'),
};

/**
 * Search templates by keyword
 */
export function searchTemplates(query: string): RuleTemplate[] {
  const lowerQuery = query.toLowerCase();
  return allTemplates.filter(template =>
    template.name.toLowerCase().includes(lowerQuery) ||
    template.description.toLowerCase().includes(lowerQuery) ||
    template.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
    template.expression.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): RuleTemplate | undefined {
  return allTemplates.find(t => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): RuleTemplate[] {
  return allTemplates.filter(t => t.category === category);
}

/**
 * Get templates by tag
 */
export function getTemplatesByTag(tag: string): RuleTemplate[] {
  return allTemplates.filter(t => t.tags.includes(tag));
}

/**
 * Template statistics
 */
export const templateStats = {
  total: allTemplates.length,
  byCategory: {
    'ai-safety': aiSafetyTemplates.length,
    'compliance': complianceTemplates.length,
    'sre': sreTemplates.filter(t => t.category === 'sre').length,
    'security': sreTemplates.filter(t => t.category === 'security').length,
    'performance': sreTemplates.filter(t => t.category === 'performance').length,
  },
  withParameters: allTemplates.filter(t => t.parameters && t.parameters.length > 0).length,
};
