// Demo API service that provides canned data for rules and signals in demo mode
// This ensures fast, reliable demo experience without external dependencies

export interface DemoRule {
  id: string
  name: string
  description: string
  expression: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface DemoSignal {
  id: string
  title: string
  description: string
  service: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  status: 'open' | 'investigating' | 'resolved' | 'false-positive'
  timestamp: string
  ruleId: string
  rule_name?: string
  impact?: 'HIGH' | 'MEDIUM' | 'LOW'
  tags?: string[]
  metadata?: {
    traceId?: string
    spanId?: string
    [key: string]: any
  }
}

// Canned rules data - Behavioral invariants from OpenTelemetry traces
const DEMO_RULES: DemoRule[] = [
  {
    id: 'rule-001',
    name: 'Payment Requires Fraud Check',
    description: 'Payment span must be preceded by fraud-check span in trace (PCI-DSS compliance)',
    expression: 'trace.spans.payment.exists && !trace.spans.fraud_check.exists',
    severity: 'CRITICAL',
    active: true,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'rule-002',
    name: 'PII Access Requires Audit Log',
    description: 'Any span accessing PII must have corresponding audit-log span (GDPR compliance)',
    expression: 'span.attributes.contains_pii == true && !trace.spans.audit_log.exists',
    severity: 'CRITICAL',
    active: true,
    createdAt: '2024-01-10T14:30:00Z',
    updatedAt: '2024-01-10T14:30:00Z',
  },
  {
    id: 'rule-003',
    name: 'API Key Validation Required',
    description: 'Data access spans must follow API key validation span',
    expression: 'span.name == "data.read" && !parent_span.name == "auth.validate_api_key"',
    severity: 'HIGH',
    active: true,
    createdAt: '2024-01-08T09:15:00Z',
    updatedAt: '2024-01-08T09:15:00Z',
  },
  {
    id: 'rule-004',
    name: 'Database Connection Pool Limit',
    description: 'Detects when service exceeds max database connections (discovered invariant)',
    expression: 'span.attributes.db_connections > 100',
    severity: 'HIGH',
    active: true,
    createdAt: '2024-01-05T16:45:00Z',
    updatedAt: '2024-01-12T11:20:00Z',
  },
  {
    id: 'rule-005',
    name: 'Rate Limit Before External API',
    description: 'External API calls must have rate-limit-check span (prevents quota exhaustion)',
    expression: 'span.attributes.http_target.external && !trace.spans.rate_limit_check.exists',
    severity: 'MEDIUM',
    active: true,
    createdAt: '2024-01-03T08:00:00Z',
    updatedAt: '2024-01-03T08:00:00Z',
  },
  {
    id: 'rule-006',
    name: 'Refund Requires Original Transaction',
    description: 'Refund span must reference original payment transaction ID',
    expression: 'span.name == "payment.refund" && !span.attributes.original_transaction_id',
    severity: 'CRITICAL',
    active: true,
    createdAt: '2024-01-02T12:00:00Z',
    updatedAt: '2024-01-02T12:00:00Z',
  },
]

// Canned signals data - Behavioral invariant violations from traces
const DEMO_SIGNALS: DemoSignal[] = [
  {
    id: 'signal-001',
    title: 'Payment Without Fraud Check',
    description: 'Payment processed without fraud-check span in trace - PCI-DSS violation',
    service: 'payment-service',
    severity: 'CRITICAL',
    status: 'open',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    ruleId: 'rule-001',
    rule_name: 'Payment Requires Fraud Check',
    impact: 'HIGH',
    tags: ['compliance', 'pci-dss', 'payment'],
    metadata: {
      traceId: 'a1b2c3d4e5f6g7h8',
      spanId: 'span-payment-001',
      amount: 1250.00,
      missing_span: 'fraud_check'
    },
  },
  {
    id: 'signal-002',
    title: 'PII Access Without Audit Log',
    description: 'User data accessed without audit-log span - GDPR compliance violation',
    service: 'user-service',
    severity: 'CRITICAL',
    status: 'investigating',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    ruleId: 'rule-002',
    rule_name: 'PII Access Requires Audit Log',
    impact: 'HIGH',
    tags: ['compliance', 'gdpr', 'pii'],
    metadata: {
      traceId: 'b2c3d4e5f6g7h8i9',
      spanId: 'span-user-read-002',
      user_id: 'usr_12345',
      missing_span: 'audit_log'
    },
  },
  {
    id: 'signal-003',
    title: 'Unauthenticated Data Access',
    description: 'Data read without API key validation span',
    service: 'api-gateway',
    severity: 'HIGH',
    status: 'resolved',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    ruleId: 'rule-003',
    rule_name: 'API Key Validation Required',
    impact: 'MEDIUM',
    tags: ['security', 'authentication', 'api'],
    metadata: {
      traceId: 'c3d4e5f6g7h8i9j0',
      spanId: 'span-data-read-003',
      endpoint: '/api/v1/customers',
      missing_span: 'auth.validate_api_key'
    },
  },
  {
    id: 'signal-004',
    title: 'Database Connection Pool Exceeded',
    description: 'Service created 127 connections, exceeding discovered limit of 100',
    service: 'order-service',
    severity: 'HIGH',
    status: 'open',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    ruleId: 'rule-004',
    rule_name: 'Database Connection Pool Limit',
    impact: 'HIGH',
    tags: ['performance', 'database', 'discovered-invariant'],
    metadata: {
      traceId: 'd4e5f6g7h8i9j0k1',
      spanId: 'span-db-connect-004',
      db_connections: 127,
      max_connections: 100
    },
  },
  {
    id: 'signal-005',
    title: 'External API Without Rate Limit',
    description: 'Stripe API called without rate-limit-check span',
    service: 'billing-service',
    severity: 'MEDIUM',
    status: 'false-positive',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    ruleId: 'rule-005',
    rule_name: 'Rate Limit Before External API',
    impact: 'LOW',
    tags: ['external-api', 'rate-limiting', 'false-positive'],
    metadata: {
      traceId: 'e5f6g7h8i9j0k1l2',
      spanId: 'span-stripe-api-005',
      api_endpoint: 'https://api.stripe.com/v1/charges',
      missing_span: 'rate_limit_check',
      note: 'Internal service, rate limiting not required'
    },
  },
  {
    id: 'signal-006',
    title: 'Refund Missing Original Transaction',
    description: 'Refund span missing original_transaction_id attribute',
    service: 'payment-service',
    severity: 'CRITICAL',
    status: 'investigating',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    ruleId: 'rule-006',
    rule_name: 'Refund Requires Original Transaction',
    impact: 'MEDIUM',
    tags: ['payment', 'refund', 'compliance'],
    metadata: {
      traceId: 'f6g7h8i9j0k1l2m3',
      spanId: 'span-refund-006',
      refund_amount: 50.00,
      missing_attribute: 'original_transaction_id'
    },
  },
]

// Simulate network delay for realistic demo experience
const simulateDelay = (ms: number = 200) =>
  new Promise(resolve => setTimeout(resolve, ms))

export class DemoApiService {
  private static rules = [...DEMO_RULES]
  private static signals = [...DEMO_SIGNALS]

  // Rules API
  static async getRules(params?: { search?: string; active?: boolean }): Promise<DemoRule[]> {
    await simulateDelay()

    let filtered = [...this.rules]

    if (params?.search) {
      const search = params.search.toLowerCase()
      filtered = filtered.filter(rule =>
        rule.name.toLowerCase().includes(search) ||
        rule.description.toLowerCase().includes(search) ||
        rule.expression.toLowerCase().includes(search)
      )
    }

    if (params?.active !== undefined) {
      filtered = filtered.filter(rule => rule.active === params.active)
    }

    return filtered
  }

  static async createRule(ruleData: Omit<DemoRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<DemoRule> {
    await simulateDelay()

    const newRule: DemoRule = {
      ...ruleData,
      id: `rule-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    this.rules.unshift(newRule)
    return newRule
  }

  static async updateRule(id: string, ruleData: Partial<Omit<DemoRule, 'id' | 'createdAt'>>): Promise<DemoRule> {
    await simulateDelay()

    const index = this.rules.findIndex(rule => rule.id === id)
    if (index === -1) throw new Error('Rule not found')

    this.rules[index] = {
      ...this.rules[index],
      ...ruleData,
      updatedAt: new Date().toISOString(),
    }

    return this.rules[index]
  }

  static async deleteRule(id: string): Promise<void> {
    await simulateDelay()

    const index = this.rules.findIndex(rule => rule.id === id)
    if (index === -1) throw new Error('Rule not found')

    this.rules.splice(index, 1)
  }

  static async activateRule(id: string): Promise<DemoRule> {
    return this.updateRule(id, { active: true })
  }

  static async deactivateRule(id: string): Promise<DemoRule> {
    return this.updateRule(id, { active: false })
  }

  // Signals API
  static async getSignals(params?: {
    status?: string
    severity?: string
    service?: string
  }): Promise<DemoSignal[]> {
    await simulateDelay()

    let filtered = [...this.signals]

    if (params?.status) {
      filtered = filtered.filter(signal => signal.status === params.status)
    }

    if (params?.severity) {
      filtered = filtered.filter(signal => signal.severity === params.severity)
    }

    if (params?.service) {
      filtered = filtered.filter(signal => signal.service === params.service)
    }

    // Sort by timestamp (newest first)
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  static async getSignalById(id: string): Promise<DemoSignal> {
    await simulateDelay()

    const signal = this.signals.find(signal => signal.id === id)
    if (!signal) throw new Error('Signal not found')

    return signal
  }

  static async investigateSignal(id: string, notes: string): Promise<DemoSignal> {
    await simulateDelay()

    const index = this.signals.findIndex(signal => signal.id === id)
    if (index === -1) throw new Error('Signal not found')

    this.signals[index].status = 'investigating'
    return this.signals[index]
  }

  static async resolveSignal(id: string, notes: string): Promise<DemoSignal> {
    await simulateDelay()

    const index = this.signals.findIndex(signal => signal.id === id)
    if (index === -1) throw new Error('Signal not found')

    this.signals[index].status = 'resolved'
    return this.signals[index]
  }

  static async markFalsePositive(id: string, notes: string): Promise<DemoSignal> {
    await simulateDelay()

    const index = this.signals.findIndex(signal => signal.id === id)
    if (index === -1) throw new Error('Signal not found')

    this.signals[index].status = 'false-positive'
    return this.signals[index]
  }

  // Analytics/Metrics API
  static async getAnalytics(): Promise<{
    totalSignalsToday: number
    openSignals: number
    resolvedToday: number
    investigatingSignals: number
  }> {
    await simulateDelay()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todaySignals = this.signals.filter(signal =>
      new Date(signal.timestamp) >= today
    )

    return {
      totalSignalsToday: todaySignals.length,
      openSignals: this.signals.filter(s => s.status === 'open').length,
      resolvedToday: todaySignals.filter(s => s.status === 'resolved').length,
      investigatingSignals: this.signals.filter(s => s.status === 'investigating').length,
    }
  }
}