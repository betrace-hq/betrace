import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { getProfilingConfig } from './config';
import { BrowserProfiler } from './browser-profiler';

export interface ProfilingStatus {
  initialized: boolean;
  error?: string;
  profiler?: BrowserProfiler;
}

export function initializeProfiling(): ProfilingStatus {
  try {
    const config = getProfilingConfig();

    if (!config) {
      return {
        initialized: false,
        error: 'Profiling configuration not available'
      };
    }

    // Create resource with service information
    const resource = Resource.default().merge(
      new Resource({
        [ATTR_SERVICE_NAME]: config.appName,
        [ATTR_SERVICE_VERSION]: config.version,
        'deployment.environment': config.environment,
        ...(config.tenantId && { 'tenant.id': config.tenantId })
      })
    );

    // Create OTLP exporter for traces
    const exporter = new OTLPTraceExporter({
      url: config.endpoint,
      headers: {},
    });

    // Create tracer provider
    const provider = new WebTracerProvider({
      resource: resource,
    });

    // Add batch processor to send traces in batches
    provider.addSpanProcessor(new BatchSpanProcessor(exporter));

    // Register the provider
    provider.register();

    // Register automatic instrumentations
    registerInstrumentations({
      instrumentations: [
        new DocumentLoadInstrumentation(),
        new UserInteractionInstrumentation({
          eventNames: ['click', 'submit'],
        }),
        new FetchInstrumentation({
          propagateTraceHeaderCorsUrls: [
            /http:\/\/localhost:.*/,
            /http:\/\/.*\.localhost:.*/,
          ],
        }),
      ],
    });

    console.log('[Profiling] OpenTelemetry initialized successfully', {
      appName: config.appName,
      endpoint: config.endpoint,
      environment: config.environment
    });

    // Initialize browser JavaScript profiler for Pyroscope
    const pyroscopeUrl = import.meta.env.VITE_PYROSCOPE_URL;
    let browserProfiler: BrowserProfiler | undefined;

    if (pyroscopeUrl) {
      try {
        browserProfiler = new BrowserProfiler({
          serverUrl: pyroscopeUrl,
          appName: config.appName + '.browser',
          tags: {
            environment: config.environment,
            version: config.version,
            runtime: 'browser',
            ...(config.tenantId && { tenant_id: config.tenantId })
          }
        });

        browserProfiler.start();
        console.log('[Profiling] Browser JavaScript profiler started →', pyroscopeUrl);
      } catch (error) {
        console.error('[Profiling] Failed to start browser profiler:', error);
      }
    }

    return {
      initialized: true,
      profiler: browserProfiler
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Profiling] Failed to initialize OpenTelemetry:', errorMessage);

    return {
      initialized: false,
      error: errorMessage
    };
  }
}
