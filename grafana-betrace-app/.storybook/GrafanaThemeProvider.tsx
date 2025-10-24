import React from 'react';
import { ThemeProvider } from './ThemeContext';

interface GrafanaThemeProviderProps {
  theme: 'light' | 'dark';
  children: React.ReactNode;
}

export const GrafanaThemeProvider: React.FC<GrafanaThemeProviderProps> = ({ theme, children }) => {
  const themeClass = theme === 'dark' ? 'theme-dark' : 'theme-light';

  return (
    <ThemeProvider theme={theme}>
      <div className={'grafana-app ' + themeClass}>
        <style>{`
        /* WCAG AA Compliant Dark Theme */
        .theme-dark {
          --background-canvas: #181B1F;
          --background-primary: #1F2329;
          --background-secondary: #272B34;
          --text-primary: #E8EAED;        /* Increased from #D8D9DA for 4.5:1 contrast */
          --text-secondary: #B8BCC2;      /* Increased from #9FA0A2 for 4.5:1 contrast */
          --text-disabled: #6C727A;       /* New: for disabled states */
          --border-weak: #31373D;
          --border-medium: #464C54;
          --border-strong: #6C727A;       /* New: for better visibility */
          --focus-outline: #58A6FF;       /* New: blue focus indicator */
          --link-color: #58A6FF;          /* New: accessible link color */
          --link-hover: #79B8FF;          /* New: link hover state */
          --error-text: #FF6B6B;          /* New: error messages */
          --success-text: #51CF66;        /* New: success messages */
          background-color: var(--background-canvas);
          color: var(--text-primary);
        }

        /* WCAG AA Compliant Light Theme */
        .theme-light {
          --background-canvas: #F4F5F5;
          --background-primary: #FFFFFF;
          --background-secondary: #F7F8FA;
          --text-primary: #0D0E11;        /* Increased from #111217 for better contrast */
          --text-secondary: #3D4248;      /* Darkened from #52545C for 4.5:1 contrast */
          --text-disabled: #888D96;       /* New: for disabled states */
          --border-weak: #D8DADF;
          --border-medium: #B0B4BB;
          --border-strong: #6C727A;       /* New: for better visibility */
          --focus-outline: #0969DA;       /* New: blue focus indicator */
          --link-color: #0969DA;          /* New: accessible link color */
          --link-hover: #0550AE;          /* New: link hover state */
          --error-text: #D1242F;          /* New: error messages */
          --success-text: #1A7F37;        /* New: success messages */
          background-color: var(--background-canvas);
          color: var(--text-primary);
        }

        .grafana-app {
          min-height: 100vh;
          width: 100%;
          padding: 16px;
        }

        /* Focus indicators for accessibility */
        .grafana-app *:focus-visible {
          outline: 2px solid var(--focus-outline);
          outline-offset: 2px;
          border-radius: 2px;
        }

        /* Remove default outline and use focus-visible */
        .grafana-app *:focus:not(:focus-visible) {
          outline: none;
        }

        /* Enhanced button focus */
        .grafana-app button:focus-visible,
        .grafana-app a:focus-visible {
          outline: 2px solid var(--focus-outline);
          outline-offset: 2px;
          box-shadow: 0 0 0 3px var(--focus-outline)33;
        }

        /* Enhanced input focus */
        .grafana-app input:focus-visible,
        .grafana-app textarea:focus-visible,
        .grafana-app select:focus-visible {
          outline: 2px solid var(--focus-outline);
          outline-offset: 0px;
          border-color: var(--focus-outline);
        }

        /* Link styling */
        .grafana-app a {
          color: var(--link-color);
          text-decoration: underline;
          text-decoration-color: transparent;
          transition: text-decoration-color 0.2s;
        }

        .grafana-app a:hover {
          color: var(--link-hover);
          text-decoration-color: currentColor;
        }

        /* Ensure sufficient contrast for secondary text */
        .grafana-app .text-secondary,
        .grafana-app [class*="secondary"] {
          color: var(--text-secondary);
        }

        /* Disabled states */
        .grafana-app :disabled,
        .grafana-app [aria-disabled="true"] {
          color: var(--text-disabled);
          cursor: not-allowed;
          opacity: 0.6;
        }

        /* Skip to content link for keyboard navigation */
        .grafana-app .skip-to-content {
          position: absolute;
          top: -40px;
          left: 0;
          background: var(--background-primary);
          color: var(--text-primary);
          padding: 8px;
          text-decoration: none;
          z-index: 100;
        }

        .grafana-app .skip-to-content:focus {
          top: 0;
        }

        /* Force all headings and text to use theme colors */
        .grafana-app h1,
        .grafana-app h2,
        .grafana-app h3,
        .grafana-app h4,
        .grafana-app h5,
        .grafana-app h6,
        .grafana-app p,
        .grafana-app div,
        .grafana-app span,
        .grafana-app label {
          color: inherit;
        }

        /* Override Grafana UI component colors in light mode */
        .theme-light input,
        .theme-light textarea {
          background-color: var(--background-primary) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-medium) !important;
        }

        .theme-light input::placeholder,
        .theme-light textarea::placeholder {
          color: var(--text-disabled) !important;
        }
      `}</style>
        {children}
      </div>
    </ThemeProvider>
  );
};
