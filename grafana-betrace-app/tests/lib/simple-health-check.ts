/**
 * Simple Health Check - Verify Services Are Running
 *
 * DOES NOT auto-start services. Simply checks if required services are available.
 * Tests will skip or fail gracefully if services are not running.
 *
 * Philosophy: Service orchestration is separate from testing.
 * Start services externally via: flox services start
 */

import axios from 'axios';

export interface ServiceHealth {
  service: string;
  url: string;
  healthy: boolean;
  error?: string;
}

/**
 * Check if a service is healthy via HTTP endpoint
 */
async function checkService(service: string, url: string, timeoutMs = 5000): Promise<ServiceHealth> {
  try {
    await axios.get(url, { timeout: timeoutMs });
    return { service, url, healthy: true };
  } catch (error) {
    return {
      service,
      url,
      healthy: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check all required BeTrace services
 * Required: grafana, backend
 * Optional: tempo, loki (not required for basic E2E tests)
 */
export async function checkBeTraceServices(): Promise<{
  allHealthy: boolean;
  services: ServiceHealth[];
  requiredHealthy: boolean;
}> {
  const grafanaPort = process.env.BETRACE_PORT_GRAFANA || '12015';
  const backendPort = process.env.BETRACE_PORT_BACKEND || '12011';

  // Required services
  const requiredServices = await Promise.all([
    checkService('grafana', `http://localhost:${grafanaPort}/api/health`),
    checkService('backend', `http://localhost:${backendPort}/v1/health`),
  ]);

  // Optional services (for full stack testing, not required for E2E)
  const optionalServices = await Promise.all([
    checkService('tempo', 'http://localhost:3200/ready'),
    checkService('loki', 'http://localhost:3100/ready'),
  ]);

  const services = [...requiredServices, ...optionalServices];
  const requiredHealthy = requiredServices.every((s) => s.healthy);
  const allHealthy = services.every((s) => s.healthy);

  return { allHealthy, services, requiredHealthy };
}

/**
 * Global setup function for Playwright
 * Returns a teardown function
 */
export default async function globalSetup() {
  console.log('\n🏥 Checking BeTrace Services Health...\n');

  const { allHealthy, services, requiredHealthy } = await checkBeTraceServices();

  // Show required services first
  console.log('   Required services:');
  services.slice(0, 2).forEach((s) => {
    if (s.healthy) {
      console.log(`   ✅ ${s.service.padEnd(10)} - ${s.url}`);
    } else {
      console.log(`   ❌ ${s.service.padEnd(10)} - ${s.url}`);
      console.log(`      Error: ${s.error}`);
    }
  });

  // Show optional services
  console.log('   Optional services:');
  services.slice(2).forEach((s) => {
    if (s.healthy) {
      console.log(`   ✅ ${s.service.padEnd(10)} - ${s.url}`);
    } else {
      console.log(`   ⚠️  ${s.service.padEnd(10)} - ${s.url} (optional)`);
    }
  });

  if (!requiredHealthy) {
    console.log('\n❌ Required services are not running. Tests will fail.');
    console.log('   Start services with: flox services start\n');
    // Don't throw - let tests run and fail with clear messages
  } else if (!allHealthy) {
    console.log('\n⚠️  Optional services not running (tempo/loki). Some features may not be testable.');
    console.log('   Core E2E tests will still run.\n');
  } else {
    console.log('\n✅ All services healthy\n');
  }

  // Return teardown function (no-op for now)
  return async () => {
    console.log('\n🧹 Test run complete\n');
  };
}

