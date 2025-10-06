import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // React ecosystem
          'react-vendor': ['react', 'react-dom'],

          // UI libraries
          'ui-vendor': [
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-select',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip'
          ],

          // TanStack ecosystem
          'tanstack-vendor': [
            '@tanstack/react-query',
            '@tanstack/react-router',
            '@tanstack/react-router-devtools',
            '@tanstack/router-devtools'
          ],

          // Form and validation
          'forms-vendor': [
            'react-hook-form',
            '@hookform/resolvers',
            'zod',
            'validator'
          ],

          // Charts and visualization
          'charts-vendor': ['recharts'],

          // Utility libraries
          'utils-vendor': [
            'lucide-react',
            'class-variance-authority',
            'clsx',
            'tailwind-merge',
            'date-fns',
            'cmdk'
          ],

          // Auth and security
          'auth-vendor': [
            '@workos-inc/node',
            'jose',
            'isomorphic-dompurify'
          ]
        }
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});