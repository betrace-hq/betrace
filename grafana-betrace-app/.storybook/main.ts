import type { StorybookConfig } from '@storybook/react-webpack5';
import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin';

const config: StorybookConfig = {
  "stories": [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@storybook/addon-webpack5-compiler-swc",
    "@storybook/addon-docs",
    "@storybook/addon-onboarding",
    "@storybook/addon-themes"
  ],
  "framework": {
    "name": "@storybook/react-webpack5",
    "options": {}
  },
  webpackFinal: async (config) => {
    // Add Monaco webpack plugin
    config.plugins?.push(
      new MonacoWebpackPlugin({
        languages: ['javascript', 'typescript'],
        features: ['!gotoSymbol'],
      })
    );

    // Disable code splitting for Monaco (same as plugin webpack config)
    if (config.optimization) {
      config.optimization.splitChunks = false;
    }

    return config;
  },
};
export default config;
