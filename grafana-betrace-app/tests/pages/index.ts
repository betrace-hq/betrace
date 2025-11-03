/**
 * Page Objects Index
 *
 * Centralized export of all page objects for easy importing.
 *
 * Usage:
 *   import { LoginPage, RulesPage, TraceDrilldownPage } from './pages';
 */

export { BasePage } from './BasePage';
export { LoginPage } from './LoginPage';
export { RulesPage } from './RulesPage';
export { TraceDrilldownPage } from './TraceDrilldownPage';
export { ConfigPage } from './ConfigPage';

// Re-export types
export type { Rule } from './RulesPage';
export type { PluginConfig } from './ConfigPage';
