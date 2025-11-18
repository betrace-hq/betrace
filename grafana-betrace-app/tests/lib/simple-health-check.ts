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
 */
export async function checkBeTraceServices(): Promise<{
  allHealthy: boolean;
  services: ServiceHealth[];
}> {
  const grafanaPort = process.env.BETRACE_PORT_GRAFANA || '12015';
  const backendPort = process.env.BETRACE_PORT_BACKEND || '12011';

  const services = await Promise.all([
    checkService('grafana', `http://localhost:${grafanaPort}/api/health`),
    checkService('backend', `http://localhost:${backendPort}/health`),
    checkService('tempo', 'http://localhost:3200/ready'),
    checkService('loki', 'http://localhost:3100/ready'),
  ]);

  const allHealthy = services.every((s) => s.healthy);

  return { allHealthy, services };
}

/**
 * Global setup function for Playwright
 * Returns a teardown function
 */
export default async function globalSetup() {
  console.log('\n🏥 Checking BeTrace Services Health...\n');

  const { allHealthy, services } = await checkBeTraceServices();

  services.forEach((s) => {
    if (s.healthy) {
      console.log(`   ✅ ${s.service.padEnd(10)} - ${s.url}`);
    } else {
      console.log(`   ❌ ${s.service.padEnd(10)} - ${s.url}`);
      console.log(`      Error: ${s.error}`);
    }
  });

  if (!allHealthy) {
    console.log('\n⚠️  Some services are not running. Tests may fail.');
    console.log('   Start services with: flox services start\n');

    // Don't throw error - let tests run and fail gracefully
    // This allows partial test runs for debugging
  } else {
    console.log('\n✅ All services healthy\n');
  }

  // Return teardown function (no-op for now)
  return async () => {
    console.log('\n🧹 Test run complete\n');
  };
}

// Allow running as standalone script (ES module compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  checkBeTraceServices()
    .then(({ allHealthy, services }) => {
      if (!allHealthy) {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Error checking services:', error);
      process.exit(1);
    });
}
