import { resolve } from 'node:path';
import babel from '@rolldown/plugin-babel';
import stylex from '@stylexjs/unplugin';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The SPA calls the API same-origin at /v1/* so the HttpOnly session cookie
// is first-party; production does this with the Vercel rewrite in vercel.json.
// Locally, run the API with DEV=true so its OAuth redirect_uri also points at
// this dev server (http://localhost:5173/v1/auth/google/callback).
const API_PROXY_TARGET = 'http://localhost:8000';

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      // `vite preview` reuses server.proxy by default.
      '/v1': { target: API_PROXY_TARGET, changeOrigin: true },
    },
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
