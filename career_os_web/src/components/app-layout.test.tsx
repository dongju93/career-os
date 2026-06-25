import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/auth-store';
import { AppLayout } from './app-layout';

// AppLayout mounts the ChatKit assistant, which imports the opaque embed at
// module load; mock it so these tests cover only the layout's drawer shell.
vi.mock('@openai/chatkit-react', () => ({
  useChatKit: () => ({
    control: {},
    focusComposer: vi.fn(),
    setThreadId: vi.fn(),
    showHistory: vi.fn(),
    hideHistory: vi.fn(),
  }),
  ChatKit: () => <div data-testid="chatkit-embed" />,
}));

function renderLayout() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppLayout />,
        children: [{ index: true, element: <div>본문</div> }],
      },
    ],
    { initialEntries: ['/'] },
  );
  return render(<RouterProvider router={router} />);
}

describe('AppLayout mobile drawer', () => {
  beforeEach(() => {
    useAuthStore.getState().setAuth({
      id: 'user-1',
      email: 'user@example.com',
      name: '사용자',
      picture: null,
    });
  });

  it('wires the menu toggle to the drawer dialog', () => {
    renderLayout();
    const toggle = screen.getByRole('button', { name: '메뉴 열기' });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-haspopup', 'dialog');

    const controls = toggle.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls as string)?.tagName).toBe('DIALOG');
  });

  it('opens the drawer, exposes an in-drawer close button, then closes', async () => {
    renderLayout();
    const toggle = screen.getByRole('button', { name: '메뉴 열기' });

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const close = screen.getByRole('button', { name: '메뉴 닫기' });
    await userEvent.click(close);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: '메뉴 닫기' })).toBeNull();
  });
});
