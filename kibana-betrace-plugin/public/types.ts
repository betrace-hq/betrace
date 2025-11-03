export interface BeTracePluginSetup {}

export interface BeTracePluginStart {}

export interface Rule {
  id: string;
  name: string;
  description: string;
  dsl: string;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  updatedAt: string;
}

export interface Violation {
  id: string;
  ruleId: string;
  ruleName: string;
  traceId: string;
  spanId: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metadata: Record<string, any>;
}
