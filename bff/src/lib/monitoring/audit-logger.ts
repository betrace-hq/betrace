/**
 * Comprehensive Audit Logging and Security Monitoring System
 */

import { AuthGuard } from '../security/auth-guard';
import type { User } from '../types/auth';

export type AuditEventType =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login_failed'
  | 'auth.session_expired'
  | 'auth.permission_denied'
  | 'signal.view'
  | 'signal.update'
  | 'signal.investigate'
  | 'signal.resolve'
  | 'signal.false_positive'
  | 'rule.create'
  | 'rule.update'
  | 'rule.delete'
  | 'rule.activate'
  | 'rule.deactivate'
  | 'tenant.update'
  | 'tenant.user_invite'
  | 'tenant.user_remove'
  | 'security.xss_attempt'
  | 'security.injection_attempt'
  | 'security.rate_limit_exceeded'
  | 'security.csrf_violation'
  | 'system.error'
  | 'system.performance';

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AuditEvent {
  id: string;
  timestamp: string;
  type: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  userEmail?: string;
  tenantId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  details: Record<string, any>;
  success: boolean;
  errorMessage?: string;
  metadata: {
    url: string;
    method?: string;
    duration?: number;
    fingerprint: string;
  };
}

export interface SecurityMetrics {
  failedLogins: number;
  rateLimitViolations: number;
  permissionDenials: number;
  suspiciousActivities: number;
  xssAttempts: number;
  injectionAttempts: number;
  lastCalculated: string;
}

export class AuditLogger {
  private events: AuditEvent[] = [];
  private maxEvents = 1000; // Keep last 1000 events in memory
  private sessionStorage = true;

  constructor() {
    // Load existing events from session storage
    if (this.sessionStorage) {
      this.loadEventsFromStorage();
    }

    // Set up periodic cleanup
    setInterval(() => this.cleanup(), 300000); // Every 5 minutes
  }

  /**
   * Log an audit event
   */
  logEvent(
    type: AuditEventType,
    details: Record<string, any>,
    options: {
      severity?: AuditSeverity;
      success?: boolean;
      errorMessage?: string;
      resource?: string;
      action?: string;
      duration?: number;
    } = {}
  ): void {
    const user = this.getCurrentUser();
    const event: AuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      severity: options.severity || this.determineSeverity(type),
      userId: user?.id,
      userEmail: user?.email,
      tenantId: this.getCurrentTenantId(),
      sessionId: this.getSessionId(),
      ipAddress: this.getClientIP(),
      userAgent: navigator.userAgent,
      resource: options.resource,
      action: options.action,
      details: AuthGuard.sanitizeForLogging(details),
      success: options.success ?? true,
      errorMessage: options.errorMessage,
      metadata: {
        url: window.location.href,
        method: details.method,
        duration: options.duration,
        fingerprint: this.generateFingerprint()
      }
    };

    this.events.push(event);

    // Limit memory usage
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Save to storage
    if (this.sessionStorage) {
      this.saveEventsToStorage();
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      this.consoleLog(event);
    }

    // Send to monitoring service in production
    if (import.meta.env.PROD) {
      this.sendToMonitoringService(event);
    }

    // Check for security alerts
    this.checkSecurityAlerts(event);
  }

  /**
   * Log authentication events
   */
  logAuth(
    type: 'login' | 'logout' | 'login_failed' | 'session_expired' | 'permission_denied',
    details: Record<string, any> = {}
  ): void {
    const severity = type === 'login_failed' || type === 'permission_denied' ? 'medium' : 'low';
    this.logEvent(`auth.${type}` as AuditEventType, details, { severity });
  }

  /**
   * Log signal operations
   */
  logSignal(
    action: 'view' | 'update' | 'investigate' | 'resolve' | 'false_positive',
    signalId: string,
    details: Record<string, any> = {}
  ): void {
    this.logEvent(`signal.${action}` as AuditEventType, {
      signalId,
      ...details
    }, {
      resource: 'signal',
      action
    });
  }

  /**
   * Log rule operations
   */
  logRule(
    action: 'create' | 'update' | 'delete' | 'activate' | 'deactivate',
    ruleId: string,
    details: Record<string, any> = {}
  ): void {
    const severity = action === 'delete' ? 'medium' : 'low';
    this.logEvent(`rule.${action}` as AuditEventType, {
      ruleId,
      ...details
    }, {
      severity,
      resource: 'rule',
      action
    });
  }

  /**
   * Log security events
   */
  logSecurity(
    type: 'xss_attempt' | 'injection_attempt' | 'rate_limit_exceeded' | 'csrf_violation',
    details: Record<string, any> = {}
  ): void {
    this.logEvent(`security.${type}` as AuditEventType, details, {
      severity: 'high',
      success: false
    });
  }

  /**
   * Log system events
   */
  logSystem(
    type: 'error' | 'performance',
    details: Record<string, any> = {},
    options: { severity?: AuditSeverity } = {}
  ): void {
    this.logEvent(`system.${type}` as AuditEventType, details, {
      severity: options.severity || 'medium'
    });
  }

  /**
   * Get events by criteria
   */
  getEvents(criteria: {
    type?: AuditEventType;
    userId?: string;
    tenantId?: string;
    severity?: AuditSeverity;
    success?: boolean;
    startTime?: string;
    endTime?: string;
    limit?: number;
  } = {}): AuditEvent[] {
    let filtered = [...this.events];

    if (criteria.type) {
      filtered = filtered.filter(e => e.type === criteria.type);
    }

    if (criteria.userId) {
      filtered = filtered.filter(e => e.userId === criteria.userId);
    }

    if (criteria.tenantId) {
      filtered = filtered.filter(e => e.tenantId === criteria.tenantId);
    }

    if (criteria.severity) {
      filtered = filtered.filter(e => e.severity === criteria.severity);
    }

    if (criteria.success !== undefined) {
      filtered = filtered.filter(e => e.success === criteria.success);
    }

    if (criteria.startTime) {
      filtered = filtered.filter(e => e.timestamp >= criteria.startTime!);
    }

    if (criteria.endTime) {
      filtered = filtered.filter(e => e.timestamp <= criteria.endTime!);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (criteria.limit) {
      filtered = filtered.slice(0, criteria.limit);
    }

    return filtered;
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics(timeWindowHours: number = 24): SecurityMetrics {
    const since = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000).toISOString();
    const recentEvents = this.getEvents({ startTime: since });

    return {
      failedLogins: recentEvents.filter(e => e.type === 'auth.login_failed').length,
      rateLimitViolations: recentEvents.filter(e => e.type === 'security.rate_limit_exceeded').length,
      permissionDenials: recentEvents.filter(e => e.type === 'auth.permission_denied').length,
      suspiciousActivities: recentEvents.filter(e =>
        e.severity === 'high' || e.severity === 'critical'
      ).length,
      xssAttempts: recentEvents.filter(e => e.type === 'security.xss_attempt').length,
      injectionAttempts: recentEvents.filter(e => e.type === 'security.injection_attempt').length,
      lastCalculated: new Date().toISOString()
    };
  }

  /**
   * Export events for analysis
   */
  exportEvents(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      return this.eventsToCSV();
    }
    return JSON.stringify(this.events, null, 2);
  }

  /**
   * Clear all events
   */
  clearEvents(): void {
    this.events = [];
    if (this.sessionStorage) {
      sessionStorage.removeItem('betrace_audit_events');
    }
  }

  private determineSeverity(type: AuditEventType): AuditSeverity {
    const severityMap: Record<string, AuditSeverity> = {
      'auth.login_failed': 'medium',
      'auth.permission_denied': 'medium',
      'security.': 'high', // Any security event
      'rule.delete': 'medium',
      'tenant.': 'medium',
      'system.error': 'medium',
      'system.performance': 'low'
    };

    for (const [prefix, severity] of Object.entries(severityMap)) {
      if (type.startsWith(prefix)) {
        return severity;
      }
    }

    return 'low';
  }

  private getCurrentUser(): User | null {
    try {
      const authData = JSON.parse(localStorage.getItem('betrace-auth-storage') || '{}');
      return authData.state?.user || null;
    } catch {
      return null;
    }
  }

  private getCurrentTenantId(): string | undefined {
    try {
      const authData = JSON.parse(localStorage.getItem('betrace-auth-storage') || '{}');
      return authData.state?.tenant?.id;
    } catch {
      return undefined;
    }
  }

  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('betrace_session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem('betrace_session_id', sessionId);
    }
    return sessionId;
  }

  private getClientIP(): string {
    // In a real application, this would be provided by the backend
    return 'client-side-unknown';
  }

  private generateFingerprint(): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx?.fillText('fingerprint', 10, 10);
    const canvasFingerprint = canvas.toDataURL();

    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvasFingerprint.substring(0, 50)
    ].join('|');

    // Simple hash
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
  }

  private consoleLog(event: AuditEvent): void {
    const severity = event.severity === 'high' || event.severity === 'critical' ? 'error' : 'log';
    console[severity](`[AUDIT] ${event.type}:`, {
      id: event.id,
      user: event.userEmail,
      success: event.success,
      details: event.details
    });
  }

  private async sendToMonitoringService(event: AuditEvent): Promise<void> {
    try {
      // In production, send to monitoring service like DataDog, Splunk, etc.
      await fetch('/api/audit/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
    } catch (error) {
      console.error('Failed to send audit event to monitoring service:', error);
    }
  }

  private checkSecurityAlerts(event: AuditEvent): void {
    // Check for patterns that indicate security threats
    if (event.severity === 'critical') {
      this.triggerSecurityAlert(event);
    }

    // Check for multiple failed logins
    if (event.type === 'auth.login_failed') {
      const recentFailures = this.getEvents({
        type: 'auth.login_failed',
        userId: event.userId,
        startTime: new Date(Date.now() - 300000).toISOString() // Last 5 minutes
      });

      if (recentFailures.length >= 3) {
        this.triggerSecurityAlert(event, 'Multiple failed login attempts detected');
      }
    }

    // Check for permission escalation attempts
    if (event.type === 'auth.permission_denied') {
      const recentDenials = this.getEvents({
        type: 'auth.permission_denied',
        userId: event.userId,
        startTime: new Date(Date.now() - 600000).toISOString() // Last 10 minutes
      });

      if (recentDenials.length >= 5) {
        this.triggerSecurityAlert(event, 'Possible privilege escalation attempt');
      }
    }
  }

  private triggerSecurityAlert(event: AuditEvent, message?: string): void {
    console.warn('🚨 SECURITY ALERT:', message || 'Critical security event detected', event);

    // In production, integrate with alerting systems
    // - Send to SIEM
    // - Trigger incident response
    // - Notify security team
  }

  private loadEventsFromStorage(): void {
    try {
      const stored = sessionStorage.getItem('betrace_audit_events');
      if (stored) {
        this.events = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load audit events from storage:', error);
    }
  }

  private saveEventsToStorage(): void {
    try {
      sessionStorage.setItem('betrace_audit_events', JSON.stringify(this.events));
    } catch (error) {
      console.error('Failed to save audit events to storage:', error);
    }
  }

  private cleanup(): void {
    // Remove events older than 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    this.events = this.events.filter(e => e.timestamp > cutoff);

    if (this.sessionStorage) {
      this.saveEventsToStorage();
    }
  }

  private eventsToCSV(): string {
    if (this.events.length === 0) return '';

    const headers = [
      'timestamp', 'type', 'severity', 'userId', 'userEmail',
      'success', 'resource', 'action', 'errorMessage', 'url'
    ];

    const rows = this.events.map(event => [
      event.timestamp,
      event.type,
      event.severity,
      event.userId || '',
      event.userEmail || '',
      event.success.toString(),
      event.resource || '',
      event.action || '',
      event.errorMessage || '',
      event.metadata.url
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();