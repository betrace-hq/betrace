# BeTrace Typography System

**Version 1.0.0** - October 2025

This document defines the BeTrace typography system, aligned with Grafana's design language.

---

## Table of Contents

1. [Type Families](#type-families)
2. [Type Scale](#type-scale)
3. [Font Weights](#font-weights)
4. [Line Heights](#line-heights)
5. [Usage Guidelines](#usage-guidelines)
6. [Code Examples](#code-examples)

---

## Type Families

### Primary: Inter

**Purpose**: All UI text, headings, body copy

**Why Inter**:
- ✅ Grafana's official font (ecosystem alignment)
- ✅ Excellent legibility at small sizes
- ✅ Wide language support (Latin, Cyrillic, Greek)
- ✅ Open source (SIL Open Font License)
- ✅ Google Fonts hosted (fast, reliable CDN)

**Source**: [Google Fonts - Inter](https://fonts.google.com/specimen/Inter)

**Weights Available**:
- 400 (Regular) - Body text, secondary headings
- 500 (Medium) - Emphasized text, labels
- 600 (Semi-Bold) - Buttons, strong emphasis
- 700 (Bold) - Primary headings, section headers

**Character Set**:
- Latin Extended
- Cyrillic
- Greek
- Tabular figures (monospaced numbers)

### Monospace: JetBrains Mono

**Purpose**: Code snippets, BeTraceDSL syntax, terminal output

**Why JetBrains Mono**:
- ✅ Designed specifically for code readability
- ✅ Clear distinction between similar characters (0 vs O, 1 vs l vs I)
- ✅ Ligatures for common code symbols (→, >=, !=)
- ✅ Open source (SIL Open Font License)
- ✅ Google Fonts hosted

**Source**: [Google Fonts - JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono)

**Weights Available**:
- 400 (Regular) - Code blocks, inline code
- 700 (Bold) - Emphasized code (keywords, syntax highlighting)

**Ligatures**:
- Enabled for code (→, >=, <=, !=, ===, &&, ||)
- Disabled for data tables (preserve exact character width)

---

## Type Scale

### Desktop Scale (≥1024px)

| Element | Size | Weight | Line Height | Example |
|---------|------|--------|-------------|---------|
| **Hero Heading** | 48px (3rem) | Bold (700) | 1.2 (58px) | Homepage hero |
| **H1** | 36px (2.25rem) | Bold (700) | 1.25 (45px) | Page titles |
| **H2** | 30px (1.875rem) | Bold (700) | 1.3 (39px) | Section headers |
| **H3** | 24px (1.5rem) | Semi-Bold (600) | 1.35 (32px) | Subsection headers |
| **H4** | 20px (1.25rem) | Semi-Bold (600) | 1.4 (28px) | Card titles |
| **H5** | 18px (1.125rem) | Medium (500) | 1.45 (26px) | List headers |
| **Body Large** | 18px (1.125rem) | Regular (400) | 1.6 (29px) | Intro paragraphs |
| **Body** | 16px (1rem) | Regular (400) | 1.6 (26px) | Main content |
| **Body Small** | 14px (0.875rem) | Regular (400) | 1.5 (21px) | Metadata, labels |
| **Caption** | 12px (0.75rem) | Regular (400) | 1.5 (18px) | Timestamps, footnotes |
| **Code** | 14px (0.875rem) | Regular (400) | 1.6 (22px) | Inline/block code |

### Mobile Scale (<1024px)

| Element | Size | Weight | Line Height | Adjustment |
|---------|------|--------|-------------|------------|
| **Hero Heading** | 36px (2.25rem) | Bold (700) | 1.2 (43px) | -12px |
| **H1** | 30px (1.875rem) | Bold (700) | 1.25 (38px) | -6px |
| **H2** | 24px (1.5rem) | Bold (700) | 1.3 (31px) | -6px |
| **H3** | 20px (1.25rem) | Semi-Bold (600) | 1.35 (27px) | -4px |
| **H4** | 18px (1.125rem) | Semi-Bold (600) | 1.4 (25px) | -2px |
| **H5** | 16px (1rem) | Medium (500) | 1.45 (23px) | -2px |
| **Body** | 16px (1rem) | Regular (400) | 1.6 (26px) | Same |
| **Code** | 14px (0.875rem) | Regular (400) | 1.6 (22px) | Same |

**Note**: Mobile adjustments maintain readability while reducing vertical space.

---

## Font Weights

### Inter Weights

**400 - Regular** (Primary Use)
- Body text
- Descriptions
- Secondary content
- List items

**500 - Medium** (Emphasis)
- Strong emphasis in paragraphs
- Labels
- Form field labels
- Navigation items

**600 - Semi-Bold** (Structural)
- Subheadings (H3-H5)
- Button text
- Tab labels
- Card titles

**700 - Bold** (Primary Hierarchy)
- Main headings (H1-H2)
- Hero text
- Section headers
- Important callouts

### JetBrains Mono Weights

**400 - Regular** (Default)
- Code blocks
- Inline code
- Terminal output
- File paths

**700 - Bold** (Syntax Highlighting)
- Keywords (rule, when, then)
- Function names
- Important variables
- Errors in code

---

## Line Heights

### Principles

1. **Headings**: Tighter line height (1.2-1.4) for visual hierarchy
2. **Body Text**: Comfortable reading (1.5-1.6) for longer content
3. **Code**: Slightly tighter (1.4-1.5) for dense information

### Line Height by Context

| Context | Line Height | Reason |
|---------|-------------|--------|
| **Headlines** | 1.2 | Tight for impact |
| **Subheadings** | 1.3-1.4 | Moderate for clarity |
| **Body Text** | 1.6 | Comfortable reading |
| **Labels** | 1.4 | Compact for UI |
| **Code** | 1.5-1.6 | Balance density/readability |
| **Buttons** | 1 | Centered vertically |

---

## Usage Guidelines

### Do's ✅

**Headings**:
- ✅ Use hierarchical structure (H1 → H2 → H3, no skipping)
- ✅ Use Bold (700) for H1-H2
- ✅ Use Semi-Bold (600) for H3-H5
- ✅ Limit hero headings to 1-2 per page

**Body Text**:
- ✅ Use Regular (400) for all body copy
- ✅ Use Medium (500) for emphasis (sparingly)
- ✅ Maintain 16px minimum for readability
- ✅ Use 60-80 characters per line for optimal reading

**Code**:
- ✅ Use JetBrains Mono for all code
- ✅ Enable ligatures for code snippets
- ✅ Use syntax highlighting (see COLOR_PALETTE.md)
- ✅ Add language identifier to code blocks

### Don'ts ❌

**Headings**:
- ❌ Don't use ALL CAPS for headings (reduces readability)
- ❌ Don't use decorative fonts
- ❌ Don't skip heading levels (H1 → H3)
- ❌ Don't use color as the only hierarchy indicator

**Body Text**:
- ❌ Don't use font sizes < 14px for critical content
- ❌ Don't use light weights (300) on light backgrounds
- ❌ Don't use excessive line lengths (> 90 characters)
- ❌ Don't use justified text (creates uneven spacing)

**Code**:
- ❌ Don't use proportional fonts for code
- ❌ Don't use font sizes < 12px
- ❌ Don't disable ligatures for readability
- ❌ Don't use syntax highlighting colors that fail WCAG

---

## Typography by Context

### Homepage

**Hero Section**:
- Heading: 48px Bold (700)
- Subheading: 18px Regular (400)
- CTA Button: 16px Semi-Bold (600)

**Value Props**:
- Section Title: 30px Bold (700)
- Card Title: 20px Semi-Bold (600)
- Card Description: 16px Regular (400)

**Use Cases**:
- Tab Label: 16px Medium (500)
- Use Case Title: 24px Semi-Bold (600)
- Use Case Body: 16px Regular (400)

### Documentation

**Page Title**: 36px Bold (700)
**Section Headers**: 24px Bold (700)
**Subsection Headers**: 20px Semi-Bold (600)
**Body Text**: 16px Regular (400)
**Code Blocks**: 14px Regular (400) JetBrains Mono
**Inline Code**: 14px Regular (400) JetBrains Mono

### Grafana Plugin UI

**Page Title**: 24px Bold (700)
**Section Headers**: 18px Semi-Bold (600)
**Body Text**: 14px Regular (400) (Grafana standard)
**Labels**: 12px Medium (500)
**Code Editor**: 14px Regular (400) JetBrains Mono

### Marketing Materials

**Slide Titles**: 36px Bold (700)
**Slide Body**: 18px Regular (400)
**Callouts**: 24px Bold (700)
**Captions**: 14px Regular (400)

---

## Code Examples

### HTML/CSS

```html
<!-- Inter Font Import (Google Fonts) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

<!-- JetBrains Mono Font Import -->
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">

<style>
  /* Base Typography */
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 16px;
    font-weight: 400;
    line-height: 1.6;
    color: #1A1A1A;
  }

  /* Headings */
  h1 {
    font-size: 36px;
    font-weight: 700;
    line-height: 1.25;
    margin-bottom: 1rem;
  }

  h2 {
    font-size: 30px;
    font-weight: 700;
    line-height: 1.3;
  }

  h3 {
    font-size: 24px;
    font-weight: 600;
    line-height: 1.35;
  }

  /* Code */
  code, pre {
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    font-size: 14px;
    line-height: 1.6;
  }

  /* Enable ligatures for code */
  code {
    font-variant-ligatures: common-ligatures;
    font-feature-settings: "liga" 1, "calt" 1;
  }
</style>
```

### CSS Variables

```css
:root {
  /* Font Families */
  --betrace-font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --betrace-font-mono: 'JetBrains Mono', 'Courier New', monospace;

  /* Font Sizes */
  --betrace-text-hero: 3rem;     /* 48px */
  --betrace-text-h1: 2.25rem;    /* 36px */
  --betrace-text-h2: 1.875rem;   /* 30px */
  --betrace-text-h3: 1.5rem;     /* 24px */
  --betrace-text-h4: 1.25rem;    /* 20px */
  --betrace-text-h5: 1.125rem;   /* 18px */
  --betrace-text-body: 1rem;     /* 16px */
  --betrace-text-small: 0.875rem; /* 14px */
  --betrace-text-caption: 0.75rem; /* 12px */

  /* Font Weights */
  --betrace-weight-regular: 400;
  --betrace-weight-medium: 500;
  --betrace-weight-semibold: 600;
  --betrace-weight-bold: 700;

  /* Line Heights */
  --betrace-leading-tight: 1.25;
  --betrace-leading-normal: 1.5;
  --betrace-leading-relaxed: 1.6;
}
```

### Tailwind CSS Configuration

```javascript
// tailwind.config.js
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        mono: ['JetBrains Mono', ...defaultTheme.fontFamily.mono],
      },
      fontSize: {
        'hero': ['48px', { lineHeight: '1.2', fontWeight: '700' }],
        'h1': ['36px', { lineHeight: '1.25', fontWeight: '700' }],
        'h2': ['30px', { lineHeight: '1.3', fontWeight: '700' }],
        'h3': ['24px', { lineHeight: '1.35', fontWeight: '600' }],
        'h4': ['20px', { lineHeight: '1.4', fontWeight: '600' }],
        'h5': ['18px', { lineHeight: '1.45', fontWeight: '500' }],
      },
      fontWeight: {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
      },
    },
  },
};
```

### React/TypeScript

```typescript
// typography.ts - Typography constants
export const typography = {
  fontFamily: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Courier New', monospace",
  },
  fontSize: {
    hero: '3rem',    // 48px
    h1: '2.25rem',   // 36px
    h2: '1.875rem',  // 30px
    h3: '1.5rem',    // 24px
    h4: '1.25rem',   // 20px
    h5: '1.125rem',  // 18px
    body: '1rem',    // 16px
    small: '0.875rem', // 14px
    caption: '0.75rem', // 12px
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.6,
  },
} as const;
```

### Grafana Plugin (React)

```tsx
// Grafana UI components with BeTrace typography
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => ({
  heading: css`
    font-family: ${theme.typography.fontFamily};
    font-size: ${theme.typography.h1.fontSize};
    font-weight: ${theme.typography.fontWeightBold};
    line-height: ${theme.typography.h1.lineHeight};
  `,
  code: css`
    font-family: ${theme.typography.fontFamilyMonospace};
    font-size: 14px;
    line-height: 1.6;
    font-variant-ligatures: common-ligatures;
  `,
});

export const RuleEditor = () => {
  const styles = useStyles2(getStyles);

  return (
    <div>
      <h1 className={styles.heading}>BeTrace Rules</h1>
      <code className={styles.code}>
        rule "Auth Retry" when ...
      </code>
    </div>
  );
};
```

---

## Accessibility Considerations

### Font Size Minimums

**WCAG 2.1 Guidelines**:
- ✅ Minimum 14px for UI text (Grafana standard)
- ✅ Minimum 16px for long-form content
- ✅ Allow browser zoom up to 200% without breaking layout

### Font Weight & Contrast

**Considerations**:
- Light weights (300) require higher contrast ratios
- Regular (400) is safe for all colors meeting WCAG AA
- Bold (700) can use slightly lower contrast (3:1 for large text)

**Best Practices**:
- Use Regular (400) or higher on all backgrounds
- Avoid light weights on light backgrounds
- Test with actual font files (not design mockups)

### Readability

**Line Length**:
- ✅ Optimal: 60-80 characters per line
- ⚠️ Acceptable: 50-90 characters
- ❌ Avoid: > 100 characters (harder to read)

**Line Spacing**:
- ✅ Body text: 1.5-1.6 line height
- ✅ Headings: 1.2-1.4 line height
- ❌ Avoid: < 1.2 (cramped) or > 2.0 (disconnected)

### Responsive Typography

**Mobile Adjustments**:
- Scale headings down 10-25% on mobile
- Maintain 16px minimum for body text
- Increase line height slightly (1.6 → 1.65) for mobile

**Breakpoints**:
```css
/* Desktop (default) */
h1 { font-size: 36px; }

/* Tablet (< 1024px) */
@media (max-width: 1023px) {
  h1 { font-size: 30px; }
}

/* Mobile (< 640px) */
@media (max-width: 639px) {
  h1 { font-size: 28px; }
}
```

---

## Version History

- **v1.0.0** (Oct 2025): Initial BeTrace typography system (Inter + JetBrains Mono)

**Last Reviewed**: 2025-10-23
**Next Review**: 2026-01-23 (Quarterly)
