import { resolve } from 'node:path';
import babel from '@rolldown/plugin-babel';
import stylex from '@stylexjs/unplugin';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig, lazyPlugins } from 'vite-plus';
import {
  licenseMetadataFile,
  thirdPartyLicenses,
  thirdPartyNoticesFile,
} from './tooling/third-party-licenses.ts';

// The SPA calls the API same-origin at /v1/* so the HttpOnly session cookie
// is first-party; production does this with the Vercel rewrite in vercel.json.
// Locally, run the API with DEV=true so its OAuth redirect_uri also points at
// this dev server (http://localhost:5173/v1/auth/google/callback).
const API_PROXY_TARGET = 'http://localhost:8000';

// https://vite.dev/config/
export default defineConfig({
  fmt: {
    // Markdown is owned by a separate formatter.
    ignorePatterns: ['**/*.md'],
    printWidth: 80,
    singleQuote: true,
    sortImports: { newlinesBetween: false },
    sortPackageJson: false,
  },
  lint: {
    plugins: ['oxc', 'typescript', 'unicorn', 'react', 'jsx-a11y'],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
      'no-unused-vars': 'error',
      'no-debugger': 'error',
      'prefer-const': 'error',
    },
    options: { typeAware: true, typeCheck: true },
  },
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
  plugins: lazyPlugins(() => [
    thirdPartyLicenses(resolve(import.meta.dirname, 'licenses')),
    // Vitest has no HTTP server to own the unplugin's CSS/HMR lifecycle.
    !process.env.VITEST && stylex.vite(),
    react(),
    babel({
      presets: [reactCompilerPreset()],
      plugins: process.env.VITEST
        ? [['@stylexjs/babel-plugin', { runtimeInjection: false }]]
        : [],
    }),
  ]),
  build: {
    license: { fileName: licenseMetadataFile },
    rolldownOptions: {
      output: {
        postBanner: `/* Third-party licenses and notices: /${thirdPartyNoticesFile} */`,
      },
    },
  },
  test: {
    // Bound parallel StyleX transforms so cold lazy-route imports remain responsive.
    maxWorkers: 4,
    css: true,
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}', 'tooling/**/*.test.ts'],
    setupFiles: './src/test/setup.ts',
    env: {
      VITE_CHATKIT_DOMAIN_KEY: 'test-placeholder',
    },
  },
});
