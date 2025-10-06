/**
 * Red Team Testing Framework for Security Validation
 * This module contains security testing utilities to validate defenses
 */

import { SecurityValidator } from './validation';
import { AuthGuard, SecurityMonitor } from './auth-guard';
import { CSRFProtection } from './csrf';

export interface SecurityTest {
  name: string;
  description: string;
  category: 'input_validation' | 'auth' | 'csrf' | 'xss' | 'injection' | 'rate_limiting';
  severity: 'low' | 'medium' | 'high' | 'critical';
  test: () => Promise<SecurityTestResult>;
}

export interface SecurityTestResult {
  passed: boolean;
  message: string;
  details?: any;
  vulnerabilityFound?: boolean;
  recommendations?: string[];
}

export class RedTeamTesting {
  private tests: SecurityTest[] = [];

  constructor() {
    this.initializeTests();
  }

  private initializeTests() {
    // Input Validation Tests
    this.tests.push({
      name: 'XSS Payload Injection',
      description: 'Test if XSS payloads are properly sanitized',
      category: 'xss',
      severity: 'high',
      test: this.testXSSPayloads.bind(this)
    });

    this.tests.push({
      name: 'SQL Injection Patterns',
      description: 'Test if SQL injection patterns are blocked',
      category: 'injection',
      severity: 'critical',
      test: this.testSQLInjection.bind(this)
    });

    this.tests.push({
      name: 'OGNL Injection',
      description: 'Test if malicious OGNL expressions are blocked',
      category: 'injection',
      severity: 'critical',
      test: this.testOGNLInjection.bind(this)
    });

    // Authentication Tests
    this.tests.push({
      name: 'Session Validation',
      description: 'Test session security and validation',
      category: 'auth',
      severity: 'high',
      test: this.testSessionValidation.bind(this)
    });

    this.tests.push({
      name: 'Permission Bypass',
      description: 'Test if permissions can be bypassed',
      category: 'auth',
      severity: 'critical',
      test: this.testPermissionBypass.bind(this)
    });

    // CSRF Tests
    this.tests.push({
      name: 'CSRF Token Validation',
      description: 'Test CSRF protection implementation',
      category: 'csrf',
      severity: 'medium',
      test: this.testCSRFProtection.bind(this)
    });

    // Rate Limiting Tests
    this.tests.push({
      name: 'Rate Limiting Bypass',
      description: 'Test if rate limiting can be bypassed',
      category: 'rate_limiting',
      severity: 'medium',
      test: this.testRateLimiting.bind(this)
    });

    // Input Validation Boundary Tests
    this.tests.push({
      name: 'Input Length Boundaries',
      description: 'Test input length validation boundaries',
      category: 'input_validation',
      severity: 'medium',
      test: this.testInputBoundaries.bind(this)
    });
  }

  async testXSSPayloads(): Promise<SecurityTestResult> {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      'javascript:alert("XSS")',
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>',
      '"><script>alert("XSS")</script>',
      "'; alert('XSS'); //",
      '<iframe src="javascript:alert(`XSS`)">',
    ];

    const vulnerabilities: string[] = [];

    for (const payload of xssPayloads) {
      try {
        const result = SecurityValidator.sanitizeHtml(payload);

        // Check if dangerous content still exists
        if (result.includes('<script>') ||
            result.includes('javascript:') ||
            result.includes('onerror=') ||
            result.includes('onload=')) {
          vulnerabilities.push(`Payload not properly sanitized: ${payload}`);
        }
      } catch (error) {
        vulnerabilities.push(`Error processing payload: ${payload}`);
      }
    }

    return {
      passed: vulnerabilities.length === 0,
      message: vulnerabilities.length === 0
        ? 'XSS protection working correctly'
        : `Found ${vulnerabilities.length} XSS vulnerabilities`,
      details: vulnerabilities,
      vulnerabilityFound: vulnerabilities.length > 0,
      recommendations: vulnerabilities.length > 0
        ? ['Review HTML sanitization logic', 'Implement stricter CSP headers']
        : []
    };
  }

  async testSQLInjection(): Promise<SecurityTestResult> {
    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "admin'--",
      "'; INSERT INTO users VALUES ('hacker', 'password'); --",
      "' UNION SELECT * FROM users --",
      "'; EXEC xp_cmdshell('dir'); --"
    ];

    const vulnerabilities: string[] = [];

    for (const payload of sqlPayloads) {
      try {
        const result = SecurityValidator.sanitizeInput(payload);

        // Check for dangerous SQL keywords
        const dangerousKeywords = ['DROP', 'INSERT', 'DELETE', 'UPDATE', 'EXEC', 'UNION'];
        const upperResult = result.toUpperCase();

        for (const keyword of dangerousKeywords) {
          if (upperResult.includes(keyword)) {
            vulnerabilities.push(`SQL keyword not sanitized: ${keyword} in payload: ${payload}`);
          }
        }
      } catch (error) {
        vulnerabilities.push(`Error processing SQL payload: ${payload}`);
      }
    }

    return {
      passed: vulnerabilities.length === 0,
      message: vulnerabilities.length === 0
        ? 'SQL injection protection working'
        : `Found ${vulnerabilities.length} SQL injection vulnerabilities`,
      details: vulnerabilities,
      vulnerabilityFound: vulnerabilities.length > 0,
      recommendations: vulnerabilities.length > 0
        ? ['Implement parameterized queries', 'Add input validation for SQL keywords']
        : []
    };
  }

  async testOGNLInjection(): Promise<SecurityTestResult> {
    const ognlPayloads = [
      'Runtime.getRuntime().exec("rm -rf /")',
      '@java.lang.Runtime@getRuntime().exec("calc")',
      'new java.lang.ProcessBuilder("cmd", "/c", "dir").start()',
      '(new java.lang.ProcessBuilder("whoami")).start()',
      '@java.lang.System@exit(0)',
      'Class.forName("java.lang.Runtime")',
    ];

    const vulnerabilities: string[] = [];

    for (const payload of ognlPayloads) {
      try {
        const result = SecurityValidator.validateOgnlExpression(payload);

        if (result.isValid) {
          vulnerabilities.push(`Dangerous OGNL payload accepted: ${payload}`);
        }
      } catch (error) {
        // Expected for dangerous payloads
      }
    }

    return {
      passed: vulnerabilities.length === 0,
      message: vulnerabilities.length === 0
        ? 'OGNL injection protection working'
        : `Found ${vulnerabilities.length} OGNL injection vulnerabilities`,
      details: vulnerabilities,
      vulnerabilityFound: vulnerabilities.length > 0,
      recommendations: vulnerabilities.length > 0
        ? ['Strengthen OGNL expression validation', 'Implement expression sandboxing']
        : []
    };
  }

  async testSessionValidation(): Promise<SecurityTestResult> {
    const issues: string[] = [];

    // Test session storage security
    try {
      // Check if sensitive data is stored in localStorage
      const authData = localStorage.getItem('fluo-auth-storage');
      if (authData && authData.includes('password')) {
        issues.push('Sensitive data found in localStorage');
      }

      // Check session timeout validation
      const mockContext = {
        user: {
          id: 'test',
          email: 'test@test.com',
          lastLoginAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
          role: 'admin',
          name: 'Test User',
          createdAt: new Date().toISOString()
        },
        tenant: null,
        sessionId: 'test-session',
        ipAddress: '127.0.0.1'
      };

      const validation = AuthGuard.validateSession(mockContext);
      if (validation.isValid) {
        issues.push('Expired session not properly detected');
      }

    } catch (error) {
      issues.push(`Session validation error: ${error}`);
    }

    return {
      passed: issues.length === 0,
      message: issues.length === 0
        ? 'Session validation working correctly'
        : `Found ${issues.length} session security issues`,
      details: issues,
      vulnerabilityFound: issues.length > 0,
      recommendations: issues.length > 0
        ? ['Implement secure session storage', 'Add session timeout validation']
        : []
    };
  }

  async testPermissionBypass(): Promise<SecurityTestResult> {
    const issues: string[] = [];

    try {
      // Test if null user can access protected resources
      const nullUserAccess = AuthGuard.hasPermission(null, 'signals:write');
      if (nullUserAccess) {
        issues.push('Null user granted permissions');
      }

      // Test if viewer role can perform admin actions
      const viewerUser = {
        id: 'viewer',
        email: 'viewer@test.com',
        role: 'viewer',
        name: 'Viewer',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };

      const viewerAdminAccess = AuthGuard.hasPermission(viewerUser, 'tenant:manage');
      if (viewerAdminAccess) {
        issues.push('Viewer role granted admin permissions');
      }

    } catch (error) {
      issues.push(`Permission test error: ${error}`);
    }

    return {
      passed: issues.length === 0,
      message: issues.length === 0
        ? 'Permission system working correctly'
        : `Found ${issues.length} permission bypass vulnerabilities`,
      details: issues,
      vulnerabilityFound: issues.length > 0,
      recommendations: issues.length > 0
        ? ['Review permission matrix', 'Add role validation']
        : []
    };
  }

  async testCSRFProtection(): Promise<SecurityTestResult> {
    const issues: string[] = [];

    try {
      // Test CSRF token generation
      const token1 = CSRFProtection.getToken();
      const token2 = CSRFProtection.getToken();

      if (!token1 || !token2) {
        issues.push('CSRF token not generated');
      }

      if (token1.length < 32) {
        issues.push('CSRF token too short');
      }

      // Test token validation
      const isValid = CSRFProtection.validateToken(token1);
      if (!isValid) {
        issues.push('Valid CSRF token rejected');
      }

      // Test invalid token rejection
      const invalidValid = CSRFProtection.validateToken('invalid-token');
      if (invalidValid) {
        issues.push('Invalid CSRF token accepted');
      }

    } catch (error) {
      issues.push(`CSRF test error: ${error}`);
    }

    return {
      passed: issues.length === 0,
      message: issues.length === 0
        ? 'CSRF protection working correctly'
        : `Found ${issues.length} CSRF vulnerabilities`,
      details: issues,
      vulnerabilityFound: issues.length > 0,
      recommendations: issues.length > 0
        ? ['Fix CSRF token validation', 'Implement proper token rotation']
        : []
    };
  }

  async testRateLimiting(): Promise<SecurityTestResult> {
    const issues: string[] = [];

    try {
      // Test rate limiting with rapid requests
      const operation = 'test_operation';
      let successCount = 0;

      for (let i = 0; i < 10; i++) {
        if (AuthGuard.checkRateLimit(operation, 5, 60000)) {
          successCount++;
        }
      }

      // Should only allow 5 requests
      if (successCount > 5) {
        issues.push(`Rate limiting not working: ${successCount} requests allowed instead of 5`);
      }

    } catch (error) {
      issues.push(`Rate limiting test error: ${error}`);
    }

    return {
      passed: issues.length === 0,
      message: issues.length === 0
        ? 'Rate limiting working correctly'
        : `Found ${issues.length} rate limiting issues`,
      details: issues,
      vulnerabilityFound: issues.length > 0,
      recommendations: issues.length > 0
        ? ['Fix rate limiting implementation', 'Add distributed rate limiting']
        : []
    };
  }

  async testInputBoundaries(): Promise<SecurityTestResult> {
    const issues: string[] = [];

    try {
      // Test extremely long inputs
      const longInput = 'A'.repeat(10000);
      const longResult = SecurityValidator.validate(longInput, { maxLength: 100 });

      if (longResult.isValid) {
        issues.push('Long input not rejected');
      }

      // Test empty required fields
      const emptyResult = SecurityValidator.validate('', { required: true });
      if (emptyResult.isValid) {
        issues.push('Empty required field accepted');
      }

      // Test boundary values
      const boundaryResult = SecurityValidator.validate('A'.repeat(100), { maxLength: 100 });
      if (!boundaryResult.isValid) {
        issues.push('Valid boundary input rejected');
      }

    } catch (error) {
      issues.push(`Input boundary test error: ${error}`);
    }

    return {
      passed: issues.length === 0,
      message: issues.length === 0
        ? 'Input validation boundaries working'
        : `Found ${issues.length} input validation issues`,
      details: issues,
      vulnerabilityFound: issues.length > 0,
      recommendations: issues.length > 0
        ? ['Review input validation logic', 'Add boundary value testing']
        : []
    };
  }

  async runAllTests(): Promise<{
    summary: {
      total: number;
      passed: number;
      failed: number;
      vulnerabilities: number;
    };
    results: Array<SecurityTest & { result: SecurityTestResult }>;
  }> {
    const results = [];
    let vulnerabilities = 0;

    console.log('🔴 Starting Red Team Security Tests...');

    for (const test of this.tests) {
      console.log(`Running: ${test.name}`);
      try {
        const result = await test.test();
        results.push({ ...test, result });

        if (result.vulnerabilityFound) {
          vulnerabilities++;
        }

        console.log(
          `${result.passed ? '✅' : '❌'} ${test.name}: ${result.message}`
        );
      } catch (error) {
        const errorResult: SecurityTestResult = {
          passed: false,
          message: `Test failed with error: ${error}`,
          vulnerabilityFound: true
        };
        results.push({ ...test, result: errorResult });
        vulnerabilities++;
        console.log(`❌ ${test.name}: Test execution failed`);
      }
    }

    const summary = {
      total: this.tests.length,
      passed: results.filter(r => r.result.passed).length,
      failed: results.filter(r => !r.result.passed).length,
      vulnerabilities
    };

    console.log('\n📊 Red Team Test Summary:');
    console.log(`Total Tests: ${summary.total}`);
    console.log(`Passed: ${summary.passed}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Vulnerabilities Found: ${summary.vulnerabilities}`);

    return { summary, results };
  }

  getTestsByCategory(category: SecurityTest['category']): SecurityTest[] {
    return this.tests.filter(test => test.category === category);
  }

  getTestsBySeverity(severity: SecurityTest['severity']): SecurityTest[] {
    return this.tests.filter(test => test.severity === severity);
  }
}

// Export singleton instance
export const redTeamTesting = new RedTeamTesting();