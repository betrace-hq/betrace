import { AppPlugin } from '@grafana/data';
import { RootPage } from './pages/RootPage';
import { ConfigPage } from './pages/ConfigPage';

/**
 * Configure Monaco Editor workers for Grafana plugin context
 */
(window as any).MonacoEnvironment = {
  getWorkerUrl: function (_moduleId: string, label: string) {
    // Workers are in the same directory as the plugin
    if (label === 'typescript' || label === 'javascript') {
      return 'public/plugins/betrace-app/ts.worker.js';
    }
    return 'public/plugins/betrace-app/editor.worker.js';
  },
};

/**
 * BeTrace Grafana App Plugin
 *
 * ADR-027: BeTrace as Grafana App Plugin
 *
 * Provides rule management UI for BeTraceDSL trace pattern matching.
 * Users create, edit, test, and manage rules through native Grafana UI.
 */
export const plugin = new AppPlugin()
  .setRootPage(RootPage)
  .addConfigPage({
    title: 'Configuration',
    icon: 'cog',
    body: ConfigPage,
    id: 'configuration',
  });
