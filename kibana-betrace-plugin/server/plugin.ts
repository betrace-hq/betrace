import {
  PluginInitializerContext,
  CoreSetup,
  CoreStart,
  Plugin,
  Logger,
} from '@kbn/core/server';

export class BeTraceServerPlugin implements Plugin {
  private readonly logger: Logger;

  constructor(initializerContext: PluginInitializerContext) {
    this.logger = initializerContext.logger.get();
  }

  public setup(core: CoreSetup) {
    this.logger.debug('BeTrace server plugin: Setup');

    // Register server-side routes if needed
    const router = core.http.createRouter();

    // Health check endpoint
    router.get(
      {
        path: '/api/betrace/health',
        validate: false,
      },
      async (context, request, response) => {
        return response.ok({
          body: {
            status: 'ok',
          },
        });
      }
    );

    return {};
  }

  public start(core: CoreStart) {
    this.logger.debug('BeTrace server plugin: Started');
    return {};
  }

  public stop() {}
}
