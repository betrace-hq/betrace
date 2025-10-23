import { AppPlugin } from '@grafana/data';
import { RootPage } from './pages/RootPage';
import { ConfigPage } from './pages/ConfigPage';

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
