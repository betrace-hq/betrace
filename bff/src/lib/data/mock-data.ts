// Instant mock data for fast UI loading
export const mockSignals = [
  {
    id: 'sig-001',
    title: 'High Error Rate in Payment Service',
    status: 'open',
    severity: 'critical',
    service: 'payment-service',
    errorRate: 15.3,
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    description: 'Error rate exceeded threshold of 5% in payment processing',
    tags: ['payment', 'error-rate', 'critical'],
  },
  {
    id: 'sig-002',
    title: 'Latency Spike in User Authentication',
    status: 'investigating',
    severity: 'warning',
    service: 'auth-service',
    latency: 2300,
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    description: 'P95 latency increased to 2.3s, threshold is 500ms',
    tags: ['auth', 'latency', 'performance'],
  },
  {
    id: 'sig-003',
    title: 'Database Connection Pool Exhausted',
    status: 'resolved',
    severity: 'warning',
    service: 'user-service',
    connections: 0,
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    description: 'Connection pool reached maximum capacity',
    tags: ['database', 'connections', 'infrastructure'],
  },
  {
    id: 'sig-004',
    title: 'Memory Usage Alert',
    status: 'false-positive',
    severity: 'info',
    service: 'web-frontend',
    memoryUsage: 85,
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    description: 'Memory usage reached 85% of allocated resources',
    tags: ['memory', 'frontend', 'resources'],
  },
];

export const mockRules = [
  {
    id: 'rule-001',
    name: 'Payment Error Rate Monitor',
    status: 'active',
    expression: 'span.service == "payment" && span.duration > 5000 && span.tags.error_rate > 0.05',
    description: 'Monitors payment service for high error rates and latency',
    threshold: '5%',
    severity: 'critical',
    spansMonitored: 847,
    servicesAffected: 12,
    lastTriggered: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
  },
  {
    id: 'rule-002',
    name: 'Database Latency Threshold',
    status: 'active',
    expression: 'span.tags.db_query == true && span.duration > 1000',
    description: 'Alerts when database queries exceed 1 second',
    threshold: '1000ms',
    severity: 'warning',
    spansMonitored: 1247,
    servicesAffected: 8,
    lastTriggered: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
  },
  {
    id: 'rule-003',
    name: 'API Rate Limit Breach',
    status: 'paused',
    expression: 'span.tags.api_endpoint != null && span.tags.rate_limited == true',
    description: 'Detects when API endpoints hit rate limits',
    threshold: 'Any occurrence',
    severity: 'warning',
    spansMonitored: 0,
    servicesAffected: 0,
    lastTriggered: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  },
];

export const mockAnalytics = {
  signalResolutionRate: 94.2,
  averageResponseTime: 1.2,
  falsePositiveRate: 2.1,
  totalSignalsToday: 23,
  resolvedToday: 19,
  openSignals: 4,
  mttrReduction: 67,
  uptimePercentage: 99.8,
  servicesMonitored: 12,
  rulesActive: 8,
  spansProcessedToday: 1284000,
  alertsFiredToday: 47,
};

export const mockServices = [
  { name: 'payment-service', status: 'healthy', uptime: 99.9, responseTime: 45 },
  { name: 'auth-service', status: 'warning', uptime: 98.7, responseTime: 234 },
  { name: 'user-service', status: 'healthy', uptime: 99.8, responseTime: 67 },
  { name: 'web-frontend', status: 'healthy', uptime: 99.9, responseTime: 23 },
  { name: 'notification-service', status: 'healthy', uptime: 99.5, responseTime: 89 },
  { name: 'reporting-service', status: 'critical', uptime: 95.2, responseTime: 1230 },
];

// Fast data access functions (synchronous)
export const getSignals = (filter?: string) => {
  if (!filter) return mockSignals;
  return mockSignals.filter(signal =>
    signal.status === filter ||
    signal.service.includes(filter) ||
    signal.title.toLowerCase().includes(filter.toLowerCase())
  );
};

export const getRules = (status?: string) => {
  if (!status) return mockRules;
  return mockRules.filter(rule => rule.status === status);
};

export const getAnalytics = () => mockAnalytics;
export const getServices = () => mockServices;

// Simulated real-time updates (for demo)
export const startMockUpdates = (callback: (data: any) => void) => {
  const interval = setInterval(() => {
    // Simulate new signal
    const newSignal = {
      id: `sig-${Date.now()}`,
      title: 'New Alert Detected',
      status: 'open',
      severity: 'warning',
      service: 'monitoring-service',
      timestamp: new Date().toISOString(),
      description: 'Real-time signal simulation',
      tags: ['demo', 'real-time'],
    };

    callback({ type: 'signal', data: newSignal });
  }, 30000); // Every 30 seconds

  return () => clearInterval(interval);
};