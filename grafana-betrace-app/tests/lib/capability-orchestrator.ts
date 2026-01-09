/**
 * Capability Orchestrator - Auto-start Required Services
 *
 * Extends test preprocessor to automatically start missing capabilities
 * instead of just failing. Integrates with Flox service orchestration.
 *
 * ## Design Principles
 *
 * 1. **Declarative**: Tests declare what they need (@requires-grafana)
 * 2. **Automatic**: Missing services are started transparently
 * 3. **Isolated**: Each test suite can have its own service sandbox
 * 4. **Clean**: Services are stopped after tests complete
 * 5. **Fast**: Services are reused across test runs when possible
 *
 * ## Usage
 *
 * ```typescript
 * // In test file:
 * /**
 *  * @requires-grafana
 *  * @requires-backend
 *  * @auto-start
 *  *\/
 * test('should load rules', async ({ page }) => {
 *   // Grafana and Backend automatically started if not running
 * });
 * ```
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { Capability, CapabilityStatus, validateCapability } from './test-preprocessor.js';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

export interface ServiceConfig {
  name: string;
  startCommand: string;
  stopCommand?: string;
  healthCheck: Capability;
  startupTimeoutMs?: number;
  dependsOn?: string[];
}

export interface OrchestrationResult {
  started: string[];
  alreadyRunning: string[];
  failed: Array<{ service: string; error: string }>;
}

// ============================================================================
// Flox Service Integration
// ============================================================================

/**
 * Check if running inside Flox environment
 */
export async function isFloxEnvironment(): Promise<boolean> {
  try {
    // Check if flox command is available
    const { stdout } = await execAsync('which flox 2>/dev/null || command -v flox');
    if (stdout.trim().length > 0) {
      return true;
    }
  } catch {
    // Fall through to env var check
  }

  // Check if we're in an activated Flox environment
  if (process.env.FLOX_ENV || process.env.FLOX_ENV_PROJECT) {
    return true;
  }

  return false;
}

/**
 * Get Flox service status
 */
export async function getFloxServiceStatus(serviceName: string): Promise<'running' | 'stopped' | 'unknown'> {
  try {
    const { stdout } = await execAsync('flox services status 2>/dev/null', {
      cwd: '/Users/sscoble/Projects/betrace',
    });

    // Parse output: "grafana    Running    12345"
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes(serviceName.toLowerCase())) {
        if (line.includes('Running')) return 'running';
        if (line.includes('Stopped')) return 'stopped';
      }
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Start Flox service
 */
export async function startFloxService(serviceName: string): Promise<void> {
  await execAsync(`flox services start ${serviceName}`, {
    cwd: '/Users/sscoble/Projects/betrace',
    timeout: 30000,
  });
}

/**
 * Stop Flox service
 */
export async function stopFloxService(serviceName: string): Promise<void> {
  await execAsync(`flox services stop ${serviceName}`, {
    cwd: '/Users/sscoble/Projects/betrace',
    timeout: 10000,
  });
}

/**
 * Start all Flox services
 */
export async function startAllFloxServices(): Promise<void> {
  await execAsync('flox services start', {
    cwd: '/Users/sscoble/Projects/betrace',
    timeout: 60000,
  });
}

// ============================================================================
// BeTrace Service Configurations
// ============================================================================

export const BETRACE_SERVICES: Record<string, ServiceConfig> = {
  grafana: {
    name: 'grafana',
    startCommand: 'flox services start grafana',
    stopCommand: 'flox services stop grafana',
    healthCheck: {
      name: 'grafana',
      type: 'http',
      validator: async () => {
        const axios = (await import('axios')).default;
        const port = process.env.BETRACE_PORT_GRAFANA || '12015';
        try {
          await axios.get(`http://localhost:${port}/api/health`, { timeout: 5000 });
          return { available: true };
        } catch (error: any) {
          return { available: false, error: error.message };
        }
      },
      retries: 5,
      retryDelayMs: 2000,
    },
    startupTimeoutMs: 15000,
  },
  backend: {
    name: 'backend',
    startCommand: 'flox services start backend',
    stopCommand: 'flox services stop backend',
    healthCheck: {
      name: 'backend',
      type: 'http',
      validator: async () => {
        const axios = (await import('axios')).default;
        const port = process.env.BETRACE_PORT_BACKEND || '12011';
        try {
          await axios.get(`http://localhost:${port}/health`, { timeout: 5000 });
          return { available: true };
        } catch (error: any) {
          return { available: false, error: error.message };
        }
      },
      retries: 5,
      retryDelayMs: 1000,
    },
    startupTimeoutMs: 10000,
  },
  tempo: {
    name: 'tempo',
    startCommand: 'flox services start tempo',
    stopCommand: 'flox services stop tempo',
    healthCheck: {
      name: 'tempo',
      type: 'http',
      validator: async () => {
        const axios = (await import('axios')).default;
        try {
          await axios.get('http://localhost:3200/ready', { timeout: 5000 });
          return { available: true };
        } catch (error: any) {
          return { available: false, error: error.message };
        }
      },
      retries: 3,
      retryDelayMs: 1000,
    },
    startupTimeoutMs: 8000,
  },
  loki: {
    name: 'loki',
    startCommand: 'flox services start loki',
    stopCommand: 'flox services stop loki',
    healthCheck: {
      name: 'loki',
      type: 'http',
      validator: async () => {
        const axios = (await import('axios')).default;
        try {
          await axios.get('http://localhost:3100/ready', { timeout: 5000 });
          return { available: true };
        } catch (error: any) {
          return { available: false, error: error.message };
        }
      },
      retries: 3,
      retryDelayMs: 1000,
    },
    startupTimeoutMs: 8000,
  },
  prometheus: {
    name: 'prometheus',
    startCommand: 'flox services start prometheus',
    stopCommand: 'flox services stop prometheus',
    healthCheck: {
      name: 'prometheus',
      type: 'http',
      validator: async () => {
        const axios = (await import('axios')).default;
        try {
          await axios.get('http://localhost:9090/-/ready', { timeout: 5000 });
          return { available: true };
        } catch (error: any) {
          return { available: false, error: error.message };
        }
      },
      retries: 3,
      retryDelayMs: 1000,
    },
    startupTimeoutMs: 8000,
  },
  alloy: {
    name: 'alloy',
    startCommand: 'flox services start alloy',
    stopCommand: 'flox services stop alloy',
    healthCheck: {
      name: 'alloy',
      type: 'tcp',
      validator: async () => {
        const net = await import('net');
        return new Promise((resolve) => {
          const socket = new net.Socket();
          socket.on('connect', () => {
            socket.destroy();
            resolve({ available: true });
          });
          socket.on('error', () => {
            socket.destroy();
            resolve({ available: false, error: 'Port 4317 not listening' });
          });
          socket.connect(4317, 'localhost');
          setTimeout(() => {
            socket.destroy();
            resolve({ available: false, error: 'Connection timeout' });
          }, 5000);
        });
      },
      retries: 3,
      retryDelayMs: 1000,
    },
    startupTimeoutMs: 8000,
  },
};

// ============================================================================
// Capability Orchestrator
// ============================================================================

export class CapabilityOrchestrator {
  private startedServices: Set<string> = new Set();

  /**
   * Ensure required capabilities are available, starting services if needed
   */
  async ensureCapabilities(
    requiredCapabilities: string[],
    options: {
      autoStart?: boolean;
      startAll?: boolean; // Start all Flox services at once (faster)
      verbose?: boolean;
    } = {}
  ): Promise<OrchestrationResult> {
    const { autoStart = true, startAll = true, verbose = true } = options;

    const result: OrchestrationResult = {
      started: [],
      alreadyRunning: [],
      failed: [],
    };

    if (verbose) {
      console.log(`\n🔧 Orchestrating ${requiredCapabilities.length} capabilities...\n`);
    }

    // Check if Flox is available
    const isFlox = await isFloxEnvironment();
    if (!isFlox && autoStart) {
      result.failed.push({
        service: 'flox',
        error: 'Flox not available - cannot auto-start services',
      });
      return result;
    }

    // Check current status of all required capabilities
    const statusChecks = await Promise.all(
      requiredCapabilities.map(async (capName) => {
        const service = BETRACE_SERVICES[capName];
        if (!service) {
          return { name: capName, available: false, error: 'Unknown service' };
        }

        const status = await validateCapability(service.healthCheck, 1, 500);
        return { name: capName, available: status.available, error: status.error };
      })
    );

    // Separate available and unavailable
    const unavailable = statusChecks.filter((s) => !s.available);
    const available = statusChecks.filter((s) => s.available);

    available.forEach((s) => result.alreadyRunning.push(s.name));

    if (verbose) {
      console.log(`✅ Already running: ${available.length ? available.map((s) => s.name).join(', ') : 'none'}`);
      if (unavailable.length > 0) {
        console.log(`⚠️  Need to start: ${unavailable.map((s) => s.name).join(', ')}`);
      }
    }

    // If nothing to start, we're done
    if (unavailable.length === 0) {
      if (verbose) console.log('\n✅ All capabilities ready\n');
      return result;
    }

    // Auto-start if enabled
    if (!autoStart) {
      unavailable.forEach((s) =>
        result.failed.push({
          service: s.name,
          error: s.error || 'Service not running and auto-start disabled',
        })
      );
      return result;
    }

    // Strategy: Start all Flox services at once (faster than individual)
    if (startAll) {
      if (verbose) console.log('\n🚀 Starting all Flox services...\n');

      try {
        await startAllFloxServices();

        // Wait for all services to become healthy
        if (verbose) console.log('⏳ Waiting for services to become healthy...\n');

        const healthChecks = await Promise.all(
          unavailable.map(async (s) => {
            const service = BETRACE_SERVICES[s.name];
            if (!service) return { name: s.name, success: false, error: 'Unknown service' };

            const status = await validateCapability(
              service.healthCheck,
              service.healthCheck.retries,
              service.healthCheck.retryDelayMs
            );

            return { name: s.name, success: status.available, error: status.error };
          })
        );

        healthChecks.forEach((check) => {
          if (check.success) {
            result.started.push(check.name);
            this.startedServices.add(check.name);
            if (verbose) console.log(`   ✅ ${check.name} is healthy`);
          } else {
            result.failed.push({ service: check.name, error: check.error || 'Health check failed' });
            if (verbose) console.log(`   ❌ ${check.name} failed: ${check.error}`);
          }
        });
      } catch (error: any) {
        unavailable.forEach((s) => result.failed.push({ service: s.name, error: error.message }));
      }
    } else {
      // Start services individually (slower but more granular)
      for (const s of unavailable) {
        const service = BETRACE_SERVICES[s.name];
        if (!service) {
          result.failed.push({ service: s.name, error: 'Unknown service' });
          continue;
        }

        try {
          if (verbose) console.log(`🚀 Starting ${s.name}...`);

          await startFloxService(s.name);

          // Wait for health check
          const status = await validateCapability(
            service.healthCheck,
            service.healthCheck.retries,
            service.healthCheck.retryDelayMs
          );

          if (status.available) {
            result.started.push(s.name);
            this.startedServices.add(s.name);
            if (verbose) console.log(`   ✅ ${s.name} is healthy`);
          } else {
            result.failed.push({ service: s.name, error: status.error || 'Health check failed' });
            if (verbose) console.log(`   ❌ ${s.name} health check failed: ${status.error}`);
          }
        } catch (error: any) {
          result.failed.push({ service: s.name, error: error.message });
          if (verbose) console.log(`   ❌ ${s.name} start failed: ${error.message}`);
        }
      }
    }

    if (verbose) {
      console.log('\n📊 Orchestration Summary:');
      console.log(`   Started: ${result.started.length}`);
      console.log(`   Already Running: ${result.alreadyRunning.length}`);
      console.log(`   Failed: ${result.failed.length}\n`);
    }

    return result;
  }

  /**
   * Stop all services that were started by this orchestrator
   */
  async cleanup(options: { verbose?: boolean } = {}): Promise<void> {
    const { verbose = true } = options;

    if (this.startedServices.size === 0) {
      if (verbose) console.log('\n🧹 No services to clean up\n');
      return;
    }

    if (verbose) {
      console.log(`\n🧹 Cleaning up ${this.startedServices.size} services...\n`);
    }

    for (const serviceName of this.startedServices) {
      try {
        if (verbose) console.log(`   Stopping ${serviceName}...`);
        await stopFloxService(serviceName);
        if (verbose) console.log(`   ✅ ${serviceName} stopped`);
      } catch (error: any) {
        if (verbose) console.log(`   ⚠️  Failed to stop ${serviceName}: ${error.message}`);
      }
    }

    this.startedServices.clear();
    if (verbose) console.log('\n✅ Cleanup complete\n');
  }

  /**
   * Get list of services started by this orchestrator
   */
  getStartedServices(): string[] {
    return Array.from(this.startedServices);
  }
}
