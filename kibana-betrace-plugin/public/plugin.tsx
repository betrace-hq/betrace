import { AppMountParameters, CoreSetup, CoreStart, Plugin } from '@kbn/core/public';
import { BeTracePluginSetup, BeTracePluginStart } from './types';

export class BeTracePlugin implements Plugin<BeTracePluginSetup, BeTracePluginStart> {
  public setup(core: CoreSetup): BeTracePluginSetup {
    // Register application
    core.application.register({
      id: 'betrace',
      title: 'BeTrace',
      category: {
        id: 'observability',
        label: 'Observability',
        order: 8000,
      },
      async mount(params: AppMountParameters) {
        // Load application bundle
        const { renderApp } = await import('./application');
        // Get start services
        const [coreStart] = await core.getStartServices();
        // Render the application
        return renderApp(coreStart, params);
      },
    });

    return {};
  }

  public start(core: CoreStart): BeTracePluginStart {
    return {};
  }

  public stop() {}
}
