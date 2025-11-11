/**
 * Test Preprocessor - Capability Validation System
 *
 * Ensures required capabilities (services, ports, processes) are running
 * before tests execute. Provides sandbox grouping for isolated test environments.
 *
 * ## Design
 *
 * 1. **Capability Detection**: Parse test files for @requires annotations
 * 2. **Capability Validation**: Health checks for required services
 * 3. **Sandbox Grouping**: Isolate tests by capability requirements
 * 4. **Fail-Fast**: Block test execution if capabilities are unavailable
 *
 * ## Usage
 *
 * ```typescript
 * // In test file:
 * /**
 *  * @requires-grafana
 *  * @requires-backend
 *  * @requires-tempo
 *  *\/
 * test('should load rules page', async ({ page }) => {
 *   // Test runs only if Grafana, Backend, and Tempo are healthy
 * });
 * ```
 *
 * ## Capability Types
 *
 * - **HTTP Service**: Health check via HTTP endpoint
 * - **TCP Port**: Check if port is listening
 * - **Process**: Check if process is running
 * - **Custom**: User-defined validation function
 */

import axios, { AxiosError } from 'axios';
import net from 'net';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

export interface Capability {
  name: string;
  type: 'http' | 'tcp' | 'process' | 'custom';
  validator: () => Promise<CapabilityStatus>;
  retries?: number;
  retryDelayMs?: number;
}

export interface CapabilityStatus {
  available: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface TestRequirements {
  capabilities: string[];
  sandbox?: string;
}

export interface SandboxConfig {
  name: string;
  capabilities: Capability[];
  setupFn?: () => Promise<void>;
  teardownFn?: () => Promise<void>;
}

// ============================================================================
// Built-in Capability Validators
// ============================================================================

/**
 * HTTP Health Check Validator
 */
export function httpHealthCheck(url: string, expectedStatus = 200): () => Promise<CapabilityStatus> {
  return async () => {
    try {
      const response = await axios.get(url, {
        timeout: 5000,
        validateStatus: (status) => status === expectedStatus,
      });
      return {
        available: true,
        metadata: {
          status: response.status,
          url,
        },
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        available: false,
        error: `HTTP health check failed: ${axiosError.message}`,
        metadata: {
          url,
          code: axiosError.code,
          status: axiosError.response?.status,
        },
      };
    }
  };
}

/**
 * TCP Port Listener Validator
 */
export function tcpPortCheck(host: string, port: number): () => Promise<CapabilityStatus> {
  return () =>
    new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({
          available: false,
          error: `Port ${port} not responding after 5s`,
          metadata: { host, port },
        });
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({
          available: true,
          metadata: { host, port },
        });
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({
          available: false,
          error: `Port ${port} not available: ${err.message}`,
          metadata: { host, port },
        });
      });

      socket.connect(port, host);
    });
}

/**
 * Process Check Validator
 */
export function processCheck(processName: string): () => Promise<CapabilityStatus> {
  return async () => {
    try {
      // Use ps to check if process is running
      const { stdout } = await execAsync(`ps aux | grep -v grep | grep "${processName}"`);
      const isRunning = stdout.trim().length > 0;

      if (isRunning) {
        return {
          available: true,
          metadata: { processName },
        };
      } else {
        return {
          available: false,
          error: `Process "${processName}" not found`,
          metadata: { processName },
        };
      }
    } catch (error) {
      return {
        available: false,
        error: `Process check failed: ${error}`,
        metadata: { processName },
      };
    }
  };
}

// ============================================================================
// Pre-defined BeTrace Capabilities
// ============================================================================

export const BETRACE_CAPABILITIES: Record<string, Capability> = {
  'grafana': {
    name: 'grafana',
    type: 'http',
    validator: httpHealthCheck('http://localhost:12015/api/health'),
    retries: 3,
    retryDelayMs: 2000,
  },
  'backend': {
    name: 'backend',
    type: 'http',
    validator: httpHealthCheck('http://localhost:12011/v1/rules'),
    retries: 3,
    retryDelayMs: 1000,
  },
  'tempo': {
    name: 'tempo',
    type: 'http',
    validator: httpHealthCheck('http://localhost:3200/ready'),
    retries: 3,
    retryDelayMs: 1000,
  },
  'loki': {
    name: 'loki',
    type: 'http',
    validator: httpHealthCheck('http://localhost:3100/ready'),
    retries: 3,
    retryDelayMs: 1000,
  },
  'prometheus': {
    name: 'prometheus',
    type: 'http',
    validator: httpHealthCheck('http://localhost:9090/-/ready'),
    retries: 3,
    retryDelayMs: 1000,
  },
  'alloy': {
    name: 'alloy',
    type: 'tcp',
    validator: tcpPortCheck('localhost', 4317), // OTLP gRPC port
    retries: 3,
    retryDelayMs: 1000,
  },
};

// ============================================================================
// Capability Validator with Retry
// ============================================================================

export async function validateCapability(
  capability: Capability,
  retries?: number,
  retryDelayMs?: number
): Promise<CapabilityStatus> {
  const maxRetries = retries ?? capability.retries ?? 1;
  const delay = retryDelayMs ?? capability.retryDelayMs ?? 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const status = await capability.validator();

    if (status.available) {
      return status;
    }

    // If not available and retries remain, wait and try again
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    } else {
      // Last attempt failed
      return {
        ...status,
        error: `${status.error} (after ${maxRetries} attempts)`,
      };
    }
  }

  // Should never reach here, but TypeScript requires it
  return { available: false, error: 'Unknown validation error' };
}

// ============================================================================
// Test Requirements Parser
// ============================================================================

/**
 * Parse test file for @requires-{capability} annotations
 */
export function parseTestRequirements(testContent: string): TestRequirements {
  const capabilities: string[] = [];
  let sandbox: string | undefined;

  // Match JSDoc-style comments with @requires-{capability}
  const requiresPattern = /@requires-(\w+)/g;
  const sandboxPattern = /@sandbox\s+(\w+)/;

  let match;
  while ((match = requiresPattern.exec(testContent)) !== null) {
    capabilities.push(match[1]);
  }

  const sandboxMatch = sandboxPattern.exec(testContent);
  if (sandboxMatch) {
    sandbox = sandboxMatch[1];
  }

  return { capabilities, sandbox };
}

// ============================================================================
// Preprocessor - Main Entry Point
// ============================================================================

export interface PreprocessorConfig {
  capabilities: Record<string, Capability>;
  sandboxes?: Record<string, SandboxConfig>;
  failFast?: boolean;
  parallel?: boolean;
}

export class TestPreprocessor {
  constructor(private config: PreprocessorConfig) {}

  /**
   * Validate all required capabilities before test execution
   */
  async validateRequirements(requirements: TestRequirements): Promise<{
    ready: boolean;
    failures: Array<{ capability: string; error: string }>;
  }> {
    const failures: Array<{ capability: string; error: string }> = [];

    // Validate each required capability
    const validations = requirements.capabilities.map(async (capabilityName) => {
      const capability = this.config.capabilities[capabilityName];
      if (!capability) {
        failures.push({
          capability: capabilityName,
          error: `Unknown capability: ${capabilityName}`,
        });
        return;
      }

      const status = await validateCapability(capability);
      if (!status.available) {
        failures.push({
          capability: capabilityName,
          error: status.error || 'Capability unavailable',
        });
      }
    });

    if (this.config.parallel) {
      await Promise.all(validations);
    } else {
      for (const validation of validations) {
        await validation;
        if (this.config.failFast && failures.length > 0) {
          break;
        }
      }
    }

    return {
      ready: failures.length === 0,
      failures,
    };
  }

  /**
   * Setup sandbox environment
   */
  async setupSandbox(sandboxName: string): Promise<void> {
    const sandbox = this.config.sandboxes?.[sandboxName];
    if (!sandbox) {
      throw new Error(`Unknown sandbox: ${sandboxName}`);
    }

    // Validate sandbox capabilities
    const requirements: TestRequirements = {
      capabilities: sandbox.capabilities.map((c) => c.name),
    };

    const validation = await this.validateRequirements(requirements);
    if (!validation.ready) {
      throw new Error(
        `Sandbox "${sandboxName}" not ready:\n` +
          validation.failures.map((f) => `  - ${f.capability}: ${f.error}`).join('\n')
      );
    }

    // Run sandbox setup
    if (sandbox.setupFn) {
      await sandbox.setupFn();
    }
  }

  /**
   * Teardown sandbox environment
   */
  async teardownSandbox(sandboxName: string): Promise<void> {
    const sandbox = this.config.sandboxes?.[sandboxName];
    if (!sandbox) {
      throw new Error(`Unknown sandbox: ${sandboxName}`);
    }

    if (sandbox.teardownFn) {
      await sandbox.teardownFn();
    }
  }
}

// ============================================================================
// Playwright Integration Helper
// ============================================================================

/**
 * Create a Playwright test.beforeAll hook that validates capabilities
 */
export function createCapabilityValidator(
  preprocessor: TestPreprocessor,
  requirements: TestRequirements
) {
  return async () => {
    const validation = await preprocessor.validateRequirements(requirements);
    if (!validation.ready) {
      throw new Error(
        'Required capabilities not available:\n' +
          validation.failures.map((f) => `  - ${f.capability}: ${f.error}`).join('\n')
      );
    }
  };
}
