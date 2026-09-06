import { resolve } from 'node:path';
import babel from '@rolldown/plugin-babel';
import stylex from '@stylexjs/unplugin';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const VITE_API_BASE_URL = 'https://career-os.fastapicloud.dev'; // Production
// const VITE_API_BASE_URL = 'http://localhost:8000'; // Local

// https://vite.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(VITE_API_BASE_URL),
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  plugins: [
    // Vitest has no HTTP server to own the unplugin's CSS/HMR lifecycle.
    !process.env.VITEST && stylex.vite(),
    react(),
    babel({
      presets: [reactCompilerPreset()],
      plugins: process.env.VITEST
        ? [['@stylexjs/babel-plugin', { runtimeInjection: false }]]
        : [],
    }),
  ],
  test: {
    // Bound parallel StyleX transforms so cold lazy-route imports remain responsive.
    maxWorkers: 4,
    css: true,
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: './src/test/setup.ts',
    env: {
      VITE_CHATKIT_DOMAIN_KEY: 'test-placeholder',
    },
  },
});
