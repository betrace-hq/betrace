import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-links',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  core: {
    builder: '@storybook/builder-vite',
  },
  async viteFinal(config) {
    // Merge custom Vite config
    return {
      ...config,
      optimizeDeps: {
        ...config.optimizeDeps,
        include: [
          ...(config.optimizeDeps?.include || []),
          '@radix-ui/react-slot',
          '@radix-ui/react-dialog',
          '@radix-ui/react-dropdown-menu',
          '@radix-ui/react-label',
          '@radix-ui/react-select',
          '@radix-ui/react-tabs',
          '@radix-ui/react-tooltip',
          '@radix-ui/react-avatar',
          '@radix-ui/react-progress',
          '@radix-ui/react-switch',
          '@radix-ui/react-alert-dialog',
          '@radix-ui/react-popover',
        ],
      },
    };
  },
};

export default config;