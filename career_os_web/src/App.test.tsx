import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderRoute } from './test/test-utils';

describe('Career OS Web app shell', () => {
  it('renders the overview route and updates shared Zustand state', async () => {
    const user = userEvent.setup();

    renderRoute('/');

    expect(
      screen.getByRole('heading', {
        name: /all installed packages are now wired into the app/i,
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /increase shared state/i }),
    );

    expect(screen.getByText(/1 synced state/i)).toBeInTheDocument();
  });

  it('navigates to the tooling page through React Router', async () => {
    const user = userEvent.setup();

    renderRoute('/');

    await user.click(screen.getByRole('link', { name: /tooling/i }));

    expect(
      await screen.findByRole('heading', {
        name: /each installed package now has a working entry point/i,
      }),
    ).toBeInTheDocument();
  });
});
