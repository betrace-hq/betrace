import React, { useEffect } from 'react';
import type { Preview } from '@storybook/react';
import { ThemeProvider } from '../src/lib/theme/theme-context';
import '../src/styles/globals.css';

// Add global styles to override Storybook defaults
const globalStyles = `
  /* Force clean backgrounds in Storybook */
  body, html, #storybook-root, #storybook-docs {
    background-color: #f9fafb !important; /* gray-50 */
  }

  body.dark, html.dark, .dark #storybook-root, .dark #storybook-docs {
    background-color: #111827 !important; /* gray-900 */
  }

  /* Override any Storybook canvas backgrounds */
  .sb-show-main, .sb-main-padded {
    background-color: inherit !important;
  }
`;

// Inject global styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = globalStyles;
  document.head.appendChild(style);
}

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      disable: true, // Disable default backgrounds, we'll use our theme system
    },
    layout: 'fullscreen', // Remove default padding that might show background
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme || 'light';

      useEffect(() => {
        const root = document.documentElement;
        const body = document.body;

        // Remove both classes first
        root.classList.remove('light', 'dark');
        body.classList.remove('light', 'dark');

        // Add the current theme class to both html and body
        root.classList.add(theme);
        body.classList.add(theme);

        // Set appropriate background color on both elements
        if (theme === 'dark') {
          root.style.backgroundColor = '#111827'; // gray-900
          body.style.backgroundColor = '#111827'; // gray-900
        } else {
          root.style.backgroundColor = '#f9fafb'; // gray-50
          body.style.backgroundColor = '#f9fafb'; // gray-50
        }
      }, [theme]);

      return (
        <ThemeProvider>
          <div
            className="min-h-screen text-foreground p-8"
            style={{
              backgroundColor: theme === 'dark' ? '#111827' : '#f9fafb', // gray-50
            }}
          >
            <Story />
          </div>
        </ThemeProvider>
      );
    },
  ],
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'sun', title: 'Light Mode' },
          { value: 'dark', icon: 'moon', title: 'Dark Mode' },
        ],
        showName: true,
        dynamicTitle: true,
      },
    },
  },
};

export default preview;