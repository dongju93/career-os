import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { resetAuthStore } from '../store/auth-store';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    addEventListener: () => {},
    addListener: () => {},
    dispatchEvent: () => false,
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: () => {},
    removeListener: () => {},
  }),
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  resetAuthStore();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
