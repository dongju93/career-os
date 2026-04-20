export type StackPackageId =
  | 'mantine'
  | 'router'
  | 'zustand'
  | 'tailwind'
  | 'vitest'
  | 'playwright';

export type StackPackage = {
  id: StackPackageId;
  label: string;
  packages: string[];
  purpose: string;
  reason: string;
  configFiles: string[];
};

export const stackPackages: StackPackage[] = [
  {
    id: 'mantine',
    label: 'Mantine UI',
    packages: ['@mantine/core', '@mantine/hooks'],
    purpose: 'Provider, layout primitives, responsive app shell, and hooks.',
    reason:
      'Gives the project a consistent component system instead of ad hoc UI.',
    configFiles: ['src/main.tsx', 'src/app/providers.tsx', 'src/app/theme.ts'],
  },
  {
    id: 'router',
    label: 'React Router',
    packages: ['react-router'],
    purpose: 'Client-side routing with a shared layout and nested routes.',
    reason:
      'Keeps route ownership explicit as the app grows past a single page.',
    configFiles: ['src/App.tsx', 'src/app/router.tsx'],
  },
  {
    id: 'zustand',
    label: 'Zustand Store',
    packages: ['zustand'],
    purpose: 'Global state shared between the overview and tooling pages.',
    reason: 'Avoids prop drilling and keeps cross-page state lightweight.',
    configFiles: ['src/store/workspace-store.ts'],
  },
  {
    id: 'tailwind',
    label: 'Tailwind CSS',
    packages: ['tailwindcss', '@tailwindcss/vite'],
    purpose: 'Utility classes for layout, spacing, and responsive composition.',
    reason: 'Speeds up iteration for page structure without replacing Mantine.',
    configFiles: ['vite.config.ts', 'src/index.css'],
  },
  {
    id: 'vitest',
    label: 'Vitest + Testing Library',
    packages: [
      'vitest',
      'jsdom',
      '@testing-library/react',
      '@testing-library/dom',
      '@testing-library/jest-dom',
      '@testing-library/user-event',
    ],
    purpose: 'Component tests in JSDOM with user-centric assertions.',
    reason: 'Covers routing and shared state before browser-level tests.',
    configFiles: ['vite.config.ts', 'src/test/setup.ts', 'src/App.test.tsx'],
  },
  {
    id: 'playwright',
    label: 'Playwright',
    packages: ['@playwright/test'],
    purpose: 'E2E browser coverage against the running Vite app.',
    reason: 'Validates that the integrated stack works in a real browser flow.',
    configFiles: ['playwright.config.ts', 'tests/e2e/app.spec.ts'],
  },
];
