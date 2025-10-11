import type { Meta, StoryObj } from '@storybook/react';
import { HeaderDisplay } from '@/components/layout/header-display';

const meta: Meta = {
  title: 'FLUO/Navigation',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Authenticated state
export const Authenticated: Story = {
  render: () => (
    <HeaderDisplay
      isAuthenticated={true}
      isDemoMode={true}
      currentPage="signals"
      userName="John Doe"
      userEmail="john@example.com"
      userInitial="J"
      onLogout={() => console.log('Logout clicked')}
      onNavigate={(page) => console.log('Navigate to:', page)}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Header with authenticated user, showing navigation links, demo mode badge, and user menu.',
      },
    },
  },
};

// Unauthenticated state
export const Unauthenticated: Story = {
  render: () => (
    <HeaderDisplay
      isAuthenticated={false}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Header for unauthenticated users, showing Sign In and Get Started buttons.',
      },
    },
  },
};

// Demo mode active
export const DemoMode: Story = {
  render: () => (
    <div className="space-y-8 p-8">
      <div>
        <h3 className="text-xl font-bold mb-4">Demo Mode Indicator</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          When in demo mode, an amber badge appears next to the user menu.
        </p>
        <div className="inline-flex items-center px-3 py-1.5 rounded-md bg-amber-100 border border-amber-300 text-amber-900 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-200 text-xs font-semibold">
          Demo Mode
        </div>
      </div>
    </div>
  ),
};

// Navigation states - Interactive test
export const NavigationStates: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-bold mb-4">Navigation Link States (Interactive Test)</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Hover over the links to test the hover behavior. Only the active state should show an underline.
        </p>

        <div className="space-y-6 p-6 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="space-y-2">
            <h4 className="font-semibold text-sm uppercase text-gray-700 dark:text-gray-300">Inactive Link (Hover to Test)</h4>
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">Should change color to blue on hover, but NO underline should appear</p>
            <div className="inline-block">
              <a
                href="#"
                className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:text-blue-700 dark:hover:text-blue-400 border-b-2 border-transparent pb-0.5"
                onClick={(e) => e.preventDefault()}
              >
                Dashboard
              </a>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-sm uppercase text-gray-700 dark:text-gray-300">Active Link (Hover to Test)</h4>
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">Should always show blue underline, even on hover</p>
            <div className="inline-block">
              <a
                href="#"
                className="text-sm font-semibold text-blue-700 dark:text-blue-400 border-b-2 border-blue-700 dark:border-blue-400 pb-0.5"
                onClick={(e) => e.preventDefault()}
              >
                Signals
              </a>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-sm uppercase text-gray-700 dark:text-gray-300">Multiple Links Side-by-Side (Real Navigation Spacing)</h4>
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">Hover over each to verify behavior</p>
            <nav className="flex items-center space-x-6">
              <a
                href="#"
                className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:text-blue-700 dark:hover:text-blue-400 border-b-2 border-transparent pb-0.5"
                onClick={(e) => e.preventDefault()}
              >
                Dashboard
              </a>
              <a
                href="#"
                className="text-sm font-semibold text-blue-700 dark:text-blue-400 border-b-2 border-blue-700 dark:border-blue-400 pb-0.5"
                onClick={(e) => e.preventDefault()}
              >
                Signals
              </a>
              <a
                href="#"
                className="text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:text-blue-700 dark:hover:text-blue-400 border-b-2 border-transparent pb-0.5"
                onClick={(e) => e.preventDefault()}
              >
                Rules
              </a>
            </nav>
          </div>
        </div>
      </div>
    </div>
  ),
};

// User menu dropdown
export const UserMenu: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-bold mb-4">User Menu Components</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          User avatar and dropdown menu with clear options.
        </p>

        <div className="space-y-6">
          {/* Avatar */}
          <div>
            <h4 className="font-semibold mb-3">User Avatar</h4>
            <div className="flex items-center gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white font-semibold text-sm border-2 border-gray-200 dark:border-gray-700">
                J
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Shows user's first initial, with clear border for visibility
              </span>
            </div>
          </div>

          {/* Demo Badge */}
          <div>
            <h4 className="font-semibold mb-3">Demo Mode Badge</h4>
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center px-3 py-1.5 rounded-md bg-amber-100 border border-amber-300 text-amber-900 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-200 text-xs font-semibold">
                Demo Mode
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Clearly visible indicator for demo accounts
              </span>
            </div>
          </div>

          {/* Menu Items */}
          <div>
            <h4 className="font-semibold mb-3">Menu Options</h4>
            <div className="inline-block w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2">
              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                <p className="font-medium text-sm text-gray-900 dark:text-gray-100">John Doe</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">john@example.com</p>
              </div>
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <span className="text-gray-500">📊</span> Dashboard
              </button>
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <span className="text-gray-500">⚙️</span> Settings
              </button>
              <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <span className="text-gray-500">🚪</span> Log out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
};

// Theme toggle
export const ThemeToggle: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-bold mb-4">Theme Toggle</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Theme toggle button allows users to switch between light and dark modes.
        </p>

        <div className="flex items-center gap-4 p-6 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <button className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <span className="text-xl">☀️</span>
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Toggle appears in header, always accessible
          </span>
        </div>
      </div>
    </div>
  ),
};

// Complete header anatomy
export const HeaderAnatomy: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-bold mb-4">Header Anatomy</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Complete breakdown of the header component with all elements labeled.
        </p>

        <div className="border-2 border-blue-500 rounded-lg overflow-hidden">
          <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between">
              {/* Left section */}
              <div className="flex items-center gap-8">
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-blue-600 rounded"></div>
                    <span className="font-bold text-xl border-b-2 border-green-500">FLUO</span>
                  </div>
                  <span className="absolute -bottom-6 left-0 text-xs text-blue-600 font-semibold whitespace-nowrap">
                    Logo & Brand
                  </span>
                </div>

                <div className="relative">
                  <div className="flex gap-6">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dashboard</span>
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-400 font-semibold border-b-2 border-blue-700 dark:border-blue-400 pb-0.5">Signals</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Rules</span>
                  </div>
                  <span className="absolute -bottom-6 left-0 text-xs text-blue-600 dark:text-blue-400 font-semibold whitespace-nowrap">
                    Navigation Links
                  </span>
                </div>
              </div>

              {/* Right section */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <button className="p-2 rounded-md hover:bg-gray-100">
                    <span>☀️</span>
                  </button>
                  <span className="absolute -bottom-6 right-0 text-xs text-blue-600 font-semibold whitespace-nowrap">
                    Theme Toggle
                  </span>
                </div>

                <div className="relative">
                  <div className="px-3 py-1.5 rounded-md bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold">
                    Demo Mode
                  </div>
                  <span className="absolute -bottom-6 right-0 text-xs text-blue-600 font-semibold whitespace-nowrap">
                    Status Badge
                  </span>
                </div>

                <div className="relative">
                  <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm border-2 border-gray-200">
                    J
                  </div>
                  <span className="absolute -bottom-6 right-0 text-xs text-blue-600 font-semibold whitespace-nowrap">
                    User Avatar
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 text-sm">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <h4 className="font-semibold mb-2">Design Principles</h4>
            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
              <li>• Clear visual hierarchy</li>
              <li>• High contrast for accessibility</li>
              <li>• Consistent spacing</li>
              <li>• Professional appearance</li>
            </ul>
          </div>

          <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
            <h4 className="font-semibold mb-2">User Experience</h4>
            <ul className="space-y-1 text-gray-600 dark:text-gray-400">
              <li>• Sticky positioning</li>
              <li>• Always accessible</li>
              <li>• Clear active states</li>
              <li>• Easy navigation</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  ),
};
