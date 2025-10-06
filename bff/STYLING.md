# FLUO Design System & Style Guide

## Overview
This document defines the design standards for the FLUO platform, covering both the marketing site and logged-in application areas. The design emphasizes modern observability aesthetics with a synthwave-inspired dark theme and professional light theme.

## Brand Identity

### Core Concept
- **Observability-first**: Design reflects data monitoring, intelligence, and real-time systems
- **Synthwave aesthetic**: Subtle cyberpunk influence with gradients and neon accents
- **Professional SaaS**: Enterprise-ready interface with clean, accessible design
- **Intelligence theme**: Visual metaphors for AI/ML, automation, and smart detection

### Brand Colors (OKLCH)
```css
/* Primary Brand */
--primary: oklch(0.55 0.18 260);        /* FLUO vibrant blue */
--primary-foreground: oklch(0.99 0.002 260);

/* Secondary */
--secondary: oklch(0.96 0.005 260);
--secondary-foreground: oklch(0.145 0.01 260);

/* Accent (synthwave purple) */
--accent: oklch(0.88 0.08 280);
--accent-foreground: oklch(0.145 0.01 260);

/* Signal Status Colors */
--signal-open: oklch(0.7 0.2 35);       /* Warning orange */
--signal-investigating: oklch(0.6 0.15 220); /* Info blue */
--signal-resolved: oklch(0.65 0.15 140); /* Success green */
--signal-false-positive: oklch(0.6 0.08 260); /* Neutral purple */
```

## Typography

### Hierarchy
- **H1**: 3xl-7xl, font-bold, gradient text for hero sections
- **H2**: 2xl-4xl, font-bold, section headers
- **H3**: lg-xl, font-medium, subsection headers
- **Body**: base-lg, regular weight
- **Caption**: sm-xs, muted foreground

### Font Usage
- **Primary font**: System font stack (optimized for performance)
- **Code/Terminal**: `font-mono` for technical content
- **Emphasis**: `font-semibold` or `font-bold` for key metrics

## Color Strategy

### Light Theme
- **Background**: Clean whites and light grays
- **Cards**: Pure white with subtle shadows
- **Text**: Dark grays (never pure black)
- **Accents**: Vibrant blues and purples

### Dark Theme
- **Background**: `oklch(0.08 0.005 260)` (~#121212)
- **Cards**: Light blue-tinted (`oklch(0.95 0.02 240)`) for contrast
- **Text**: Light blue-tinted (`oklch(0.85 0.01 240)`) for warmth
- **Headers**: Nearly white (`oklch(0.95 0.01 240)`)

### Critical Rules
1. **Header always white**: Header remains white with dark text in all modes
2. **Context-aware contrast**: Text color adapts to immediate parent background
3. **Preserve intentional dark sections**: Terminal/code areas maintain dark backgrounds
4. **Soft contrast**: Avoid harsh white-on-black contrast
5. **Maximum contrast limits**: Never use pure white (#FFFFFF) on pure black (#000000) or vice versa

## Component Standards

### Cards
```tsx
// Standard card with proper theming
<Card className="overflow-hidden shadow-xl">
  <CardHeader className="bg-gradient-to-r from-blue-500/10 to-purple-500/10">
    <CardTitle>Component Title</CardTitle>
    <CardDescription>Descriptive text</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content automatically inherits proper contrast */}
  </CardContent>
</Card>
```

### Buttons
- **Primary**: Green gradient (`from-green-500 to-emerald-600`)
- **Secondary**: Outline with hover states
- **Ghost**: Transparent with subtle hover
- **Destructive**: Red with proper contrast

### Status Indicators
```tsx
// Signal status badges
<Badge className="signal-open">OPEN</Badge>
<Badge className="signal-investigating">INVESTIGATING</Badge>
<Badge className="signal-resolved">RESOLVED</Badge>
<Badge className="signal-false-positive">FALSE POSITIVE</Badge>
```

### Terminal/Code Sections
```tsx
// Dark terminal aesthetic (preserved in all themes)
<div className="bg-gradient-to-br from-slate-950 to-purple-950 text-white p-6 font-mono text-sm rounded-lg relative overflow-hidden">
  <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-transparent rounded-full blur-xl"></div>
  <div className="relative z-10">
    {/* Colored terminal output */}
  </div>
</div>
```

## Layout Standards

### Marketing Site
- **Hero sections**: Full-width with animated backgrounds
- **Gradients**: Subtle multi-color backgrounds (`from-blue-50 via-purple-50 to-pink-50`)
- **Stats/Features**: Grid layouts with hover effects
- **CTAs**: Prominent buttons with animations

### Application Interface
- **Header**: Fixed white header with navigation
- **Sidebar**: Theme-aware with proper contrast
- **Main content**: Cards on background with consistent spacing
- **Data tables**: Zebra striping and hover states

## Animation & Effects

### Approved Animations
- **Pulse**: For live indicators and status
- **Hover scale**: Subtle `hover:scale-105` for interactive elements
- **Gradient shifts**: Smooth color transitions
- **Fade in/out**: For modals and transitions
- **Bounce**: Minimal, for notification dots

### Performance Rules
- Use `transform` over position changes
- Prefer `opacity` and `transform` for animations
- Keep animations under 300ms
- Use `transition-all duration-200` for most hover states

## Accessibility Standards

### Contrast Requirements
- **Text**: Minimum 4.5:1 contrast ratio (WCAG AA)
- **UI components**: Minimum 3:1 contrast ratio
- **Interactive elements**: Clear focus states
- **Color coding**: Never rely solely on color

### Maximum Contrast Guidelines
To maintain visual comfort and prevent eye strain:

- **Maximum recommended contrast**: 15:1 ratio
- **Never use pure extremes**:
  - ❌ Pure white (#FFFFFF) on pure black (#000000) = 21:1 ratio (too harsh)
  - ❌ Pure black (#000000) on pure white (#FFFFFF) = 21:1 ratio (too harsh)
- **Recommended alternatives**:
  - ✅ Light blue-tinted text (`oklch(0.92 0.01 240)`) on dark background = ~12:1 ratio
  - ✅ Dark gray (`oklch(0.145 0.01 260)`) on light background = ~13:1 ratio
  - ✅ Near-white (`oklch(0.95 0.01 240)`) for headings in dark mode

### Implementation
- All interactive elements have focus rings
- Semantic HTML structure
- ARIA labels for complex components
- Keyboard navigation support
- Contrast ratios tested with tools like WebAIM Contrast Checker

## Dark Mode Implementation

### CSS Strategy
```css
/* Aggressive specificity for reliable theming */
html.dark [data-slot="card"] {
  background: oklch(0.95 0.02 240) !important;
}

/* Context-aware text colors */
html.dark [data-slot="card"] > * {
  color: oklch(0.12 0.02 240) !important;
}

/* Preserve dark sections */
html.dark [data-slot="card"] [class*="bg-slate-9"] * {
  color: inherit !important;
}
```

### Component Approach
- Use explicit theme classes: `dark:bg-slate-800`
- Provide both light and dark variants
- Test contrast in both modes
- Avoid relying on global CSS overrides

## Common Patterns

### Gradient Backgrounds
```css
/* Hero sections */
.hero-gradient {
  background: linear-gradient(135deg,
    rgb(59 130 246 / 0.1) 0%,
    rgb(147 51 234 / 0.1) 50%,
    rgb(236 72 153 / 0.1) 100%);
}

/* Card headers */
.card-header-gradient {
  background: linear-gradient(90deg,
    rgb(59 130 246 / 0.1) 0%,
    rgb(147 51 234 / 0.1) 100%);
}
```

### Status Styling
```tsx
// Error states
<div className="p-2 rounded bg-red-900/20 border border-red-500/20">
  <span className="text-red-300">Error content</span>
</div>

// Success states
<div className="p-2 rounded bg-green-900/20 border border-green-500/20">
  <span className="text-green-300">Success content</span>
</div>
```

## Quality Checklist

### Marketing Site
- [ ] Hero section has animated background elements
- [ ] Gradient text on key headings
- [ ] Hover animations on interactive elements
- [ ] Consistent button styling
- [ ] Stats section with grid layout
- [ ] Social proof section
- [ ] CTA sections with prominent buttons

### Logged-in Application
- [ ] White header in all themes
- [ ] Cards with proper contrast
- [ ] Status badges use utility classes
- [ ] Data tables with consistent styling
- [ ] Form elements follow design system
- [ ] Loading states and empty states
- [ ] Error handling with proper styling

### Cross-platform
- [ ] Dark mode works consistently
- [ ] Text contrast meets WCAG AA (4.5:1 minimum)
- [ ] Text contrast does not exceed maximum recommendation (15:1)
- [ ] No pure white on pure black combinations
- [ ] Focus states are visible
- [ ] Animations perform smoothly
- [ ] Mobile responsive design
- [ ] Terminal sections preserve dark styling
- [ ] Brand colors used consistently

## Maintenance

### When Adding New Components
1. Check existing patterns first
2. Use design tokens (CSS custom properties)
3. Implement both light and dark variants
4. Test contrast ratios
5. Add to this style guide if it's a new pattern

### Regular Audits
- Monthly contrast ratio checks
- Performance impact of animations
- Cross-browser compatibility
- Mobile experience validation
- Accessibility testing with screen readers