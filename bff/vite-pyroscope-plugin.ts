import type { Plugin } from 'vite';

export function pyroscopePlugin(): Plugin {
  let isProfilingStarted = false;
  let Pyroscope: any = null;

  return {
    name: 'vite-pyroscope-plugin',
    async configResolved(config) {
      // Only profile in development mode
      if (config.mode === 'development' && !isProfilingStarted) {
        try {
          // Dynamically import Pyroscope to handle native module errors gracefully
          const pyroscopeModule = await import('@pyroscope/nodejs');
          Pyroscope = pyroscopeModule.default;

          const serverUrl = process.env.VITE_PYROSCOPE_URL || 'http://localhost:4040';

          Pyroscope.init({
            serverAddress: serverUrl,
            appName: 'fluo.bff.dev-server',
            tags: {
              environment: 'development',
              runtime: 'nodejs',
              component: 'vite-dev-server'
            },
          });

          Pyroscope.start();
          isProfilingStarted = true;

          console.log('[Pyroscope] Vite dev server profiling started →', serverUrl);
        } catch (error: any) {
          console.warn('[Pyroscope] Failed to start server profiling (native modules not available):', error.message);
          console.warn('[Pyroscope] Server profiling disabled, browser profiling will still work');
        }
      }
    },
    buildEnd() {
      if (isProfilingStarted && Pyroscope) {
        try {
          Pyroscope.stop();
          console.log('[Pyroscope] Vite dev server profiling stopped');
        } catch (error) {
          console.error('[Pyroscope] Error stopping profiler:', error);
        }
      }
    },
  };
}
