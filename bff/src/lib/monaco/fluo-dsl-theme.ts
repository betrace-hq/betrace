import type * as Monaco from 'monaco-editor';

/**
 * BeTrace DSL Custom Theme for Monaco Editor
 *
 * Dark theme aligned with BeTrace's design system.
 * Provides syntax highlighting colors for keywords, operators, strings, etc.
 */

export interface BeTraceDslTheme {
  base: 'vs' | 'vs-dark' | 'hc-black';
  inherit: boolean;
  rules: Monaco.editor.ITokenThemeRule[];
  colors: { [colorId: string]: string };
}

/**
 * BeTrace DSL Dark Theme
 *
 * Color Palette:
 * - Keywords (trace, has, where): Purple (#C586C0)
 * - Operators (==, !=, >): Light Gray (#D4D4D4)
 * - Strings: Orange (#CE9178)
 * - Numbers: Green (#B5CEA8)
 * - Comments: Muted Green (#6A9955)
 * - Identifiers: Light Blue (#9CDCFE)
 */
export const betraceDslTheme: BeTraceDslTheme = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'C586C0', fontStyle: 'bold' }, // Purple
    { token: 'operator', foreground: 'D4D4D4' }, // Light gray
    { token: 'string', foreground: 'CE9178' }, // Orange
    { token: 'number', foreground: 'B5CEA8' }, // Green
    { token: 'number.float', foreground: 'B5CEA8' }, // Green
    { token: 'comment', foreground: '6A9955', fontStyle: 'italic' }, // Muted green
    { token: 'identifier', foreground: '9CDCFE' }, // Light blue
    { token: 'bracket', foreground: 'FFD700' }, // Gold
    { token: 'string.invalid', foreground: 'F44747' }, // Red for errors
  ],
  colors: {
    'editor.background': '#1e1e1e',
    'editor.foreground': '#d4d4d4',
    'editor.lineHighlightBackground': '#2a2a2a',
    'editorLineNumber.foreground': '#858585',
    'editorCursor.foreground': '#ffffff',
    'editor.selectionBackground': '#264f78',
    'editor.inactiveSelectionBackground': '#3a3d41',
  },
};

/**
 * Registers BeTrace DSL theme with Monaco Editor
 *
 * Call this once when Monaco Editor is initialized.
 *
 * @param monaco - Monaco Editor global instance
 */
export function registerBeTraceDslTheme(monaco: typeof Monaco): void {
  monaco.editor.defineTheme('betrace-dsl-dark', {
    base: betraceDslTheme.base,
    inherit: betraceDslTheme.inherit,
    rules: betraceDslTheme.rules,
    colors: betraceDslTheme.colors,
  });
}
