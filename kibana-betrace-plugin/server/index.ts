import { PluginInitializerContext } from '@kbn/core/server';
import { BeTraceServerPlugin } from './plugin';

export const plugin = (initializerContext: PluginInitializerContext) =>
  new BeTraceServerPlugin(initializerContext);
