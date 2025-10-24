import { AppPlugin } from '@grafana/data';
import { RootPage } from './pages/RootPage';
import { ConfigPage } from './pages/ConfigPage';

/**
 * Configure Monaco Editor workers for Grafana plugin context
 *
 * Monaco workers need to be loaded from the correct path in Grafana.
 * We use getWorker to create inline workers that load the actual worker files.
 */
(window as any).MonacoEnvironment = {
  getWorker: function (_moduleId: string, label: string) {
    const workerPath = label === 'typescript' || label === 'javascript'
      ? '/public/plugins/betrace-app/ts.worker.js'
      : '/public/plugins/betrace-app/editor.worker.js';

    // Create a blob URL worker that imports the actual worker
    const blob = new Blob([`importScripts('${workerPath}');`], { type: 'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
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
