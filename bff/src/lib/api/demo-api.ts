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
}

// Canned rules data - Real software invariants
const DEMO_RULES: DemoRule[] = [
  {
    id: 'rule-001',
    name: 'RBAC Authorization Bypass',
    description: 'Detects when a viewer role attempts mutation operations',
    expression: 'user.role == "viewer" && operation.type == "mutation"',
    severity: 'CRITICAL',
    active: true,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'rule-002',
    name: 'Transaction Balance Consistency',
    description: 'Ensures account balance never goes negative in financial operations',
    expression: 'account.balance < 0 && transaction.type == "debit"',
    severity: 'CRITICAL',
    active: true,
    createdAt: '2024-01-10T14:30:00Z',
    updatedAt: '2024-01-10T14:30:00Z',
  },
  {
    id: 'rule-003',
    name: 'Data Structure Boundary Violation',
    description: 'Detects array out-of-bounds access attempts',
    expression: 'array.index >= array.length || array.index < 0',
    severity: 'HIGH',
    active: true,
    createdAt: '2024-01-08T09:15:00Z',
    updatedAt: '2024-01-08T09:15:00Z',
  },
  {
    id: 'rule-004',
    name: 'Session State Consistency',
    description: 'Detects invalid session state transitions',
    expression: 'session.state == "expired" && user.authenticated == true',
    severity: 'MEDIUM',
    active: false,
    createdAt: '2024-01-05T16:45:00Z',
    updatedAt: '2024-01-12T11:20:00Z',
  },
  {
    id: 'rule-005',
    name: 'Resource Allocation Invariant',
    description: 'Ensures allocated resources never exceed available capacity',
    expression: 'resource.allocated > resource.capacity',
    severity: 'HIGH',
    active: true,
    createdAt: '2024-01-03T08:00:00Z',
    updatedAt: '2024-01-03T08:00:00Z',
  },
]

// Canned signals data - Real invariant violations
const DEMO_SIGNALS: DemoSignal[] = [
  {
    id: 'signal-001',
    title: 'RBAC Authorization Bypass',
    description: 'Viewer role attempted DELETE operation on critical resource',
    service: 'user-service',
    severity: 'CRITICAL',
    status: 'open',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    ruleId: 'rule-001',
  },
  {
    id: 'signal-002',
    title: 'Transaction Balance Consistency',
    description: 'Account balance went negative during withdrawal operation',
    service: 'payment-service',
    severity: 'CRITICAL',
    status: 'investigating',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    ruleId: 'rule-002',
  },
  {
    id: 'signal-003',
    title: 'Data Structure Boundary Violation',
    description: 'Array index -1 accessed in user preference lookup',
    service: 'inventory-service',
    severity: 'HIGH',
    status: 'resolved',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    ruleId: 'rule-003',
  },
  {
    id: 'signal-004',
    title: 'Resource Allocation Invariant',
    description: 'CPU allocation exceeded capacity: 120% of available cores',
    service: 'notification-service',
    severity: 'HIGH',
    status: 'open',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    ruleId: 'rule-005',
  },
  {
    id: 'signal-005',
    title: 'RBAC Authorization Bypass',
    description: 'Guest user attempted admin panel access',
    service: 'auth-service',
    severity: 'CRITICAL',
    status: 'false-positive',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    ruleId: 'rule-001',
  },
  {
    id: 'signal-006',
    title: 'Session State Consistency',
    description: 'Expired session still showing as authenticated',
    service: 'session-service',
    severity: 'MEDIUM',
    status: 'investigating',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    ruleId: 'rule-004',
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