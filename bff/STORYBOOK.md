# FLUO Storybook - Live Style Guide

## Overview
Storybook serves as the live style guide and component documentation for the FLUO frontend. It provides a centralized reference for all UI components, design patterns, and styling standards.

## 🚀 Quick Start

### Using Nix (Recommended)
```bash
# Start Storybook with Nix
nix run .#storybook

# Or within Nix development shell
nix develop --command npm run storybook
```

### Using npm directly
```bash
npm run storybook        # Start development server on http://localhost:6006
npm run build-storybook  # Build static Storybook site
```

## 📚 Available Stories

### Style Guide
- **Color Palette** - FLUO brand colors and neutral palette
- **Typography** - Heading hierarchy and text styles
- **Spacing** - Spacing scale and utilities
- **Buttons** - All button variants, sizes, and states
- **Badges** - Status and severity badge styles
- **Cards** - Card layouts and variations
- **Forms** - Input components and form patterns
- **Alerts** - Alert types and messaging
- **Tabs** - Tabbed interface examples

### FLUO Components
- **Signal Status Badges** - Open, Investigating, Resolved, False Positive
- **Signal Severity Badges** - Critical, High, Medium, Low
- **Signal Stats Cards** - Dashboard statistics display
- **Signal Table** - Complete signals table with all columns
- **Empty States** - No data messaging
- **Loading States** - Loading indicators
- **Error States** - Error messaging and retry actions

## 🎨 Design Principles

### Color System
- **Primary**: Blue-600 for primary actions and branding
- **Success**: Emerald-500 for positive states
- **Warning**: Amber-500 for caution states
- **Danger**: Red-500 for critical/error states
- **Neutrals**: Gray scale from 50-950

### Typography Scale
- **Headings**: 4xl (36px) down to lg (18px)
- **Body**: base (16px) for standard text
- **Small**: sm (14px) for secondary text
- **Caption**: xs (12px) for metadata

### Component Guidelines
1. **Consistency**: Use existing component variants
2. **Accessibility**: Ensure proper contrast and ARIA labels
3. **Responsiveness**: Test on multiple screen sizes
4. **Dark Mode**: Support both light and dark themes
5. **Performance**: Keep bundle sizes minimal

## 🔧 Adding New Stories

Create a new story file in `src/stories/`:

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { YourComponent } from '@/components/your-component';

const meta: Meta<typeof YourComponent> = {
  title: 'Category/YourComponent',
  component: YourComponent,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    // Your default props
  },
};
```

## 📋 Component Checklist

When creating new components:
- [ ] Create story with all variants
- [ ] Document props with descriptions
- [ ] Include usage examples
- [ ] Test dark mode compatibility
- [ ] Verify responsive behavior
- [ ] Check accessibility (keyboard, screen reader)
- [ ] Optimize bundle size

## 🚨 Common Patterns

### Status Indicators
- **Red** (bg-red-500): Critical, Open, Error
- **Amber** (bg-amber-500): Warning, Investigating
- **Emerald** (bg-emerald-500): Success, Resolved
- **Gray** (bg-gray-500): Inactive, False Positive

### Card Layouts
- Always use consistent padding (p-6)
- Include clear headers with titles
- Support both light and dark themes
- Consider mobile viewport constraints

### Table Design
- Hover states for rows (hover:bg-gray-50)
- Clear column headers
- Action buttons aligned right
- Responsive overflow handling

## 🛠️ Troubleshooting

### Port conflicts
If port 6006 is in use:
```bash
npx storybook dev -p 6007
```

### Build issues
Clear cache and rebuild:
```bash
rm -rf node_modules/.cache
npm run storybook
```

### Nix issues
Ensure you're in the development shell:
```bash
nix develop
npm install
npm run storybook
```

## 📖 Resources
- [Storybook Documentation](https://storybook.js.org/docs)
- [Tailwind CSS Classes](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Radix UI Primitives](https://www.radix-ui.com)