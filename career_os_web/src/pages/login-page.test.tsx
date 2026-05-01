import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderRoute } from '../test/test-utils';

describe('LoginPage', () => {
  it('renders the heading and Google login button', async () => {
    renderRoute('/login');
    expect(
      await screen.findByRole('heading', { name: /^Career OS$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Google로 계속하기/i }),
    ).toBeInTheDocument();
  });

  it('shows the auth_failed error message', async () => {
    renderRoute('/login?error=auth_failed');
    expect(
      await screen.findByText('로그인에 실패했습니다. 다시 시도해주세요.'),
    ).toBeInTheDocument();
  });

  it('shows the DATABASE_UNAVAILABLE error message', async () => {
    renderRoute('/login?error=DATABASE_UNAVAILABLE');
    expect(
      await screen.findByText(/데이터베이스 연결이 일시적으로 불안정합니다/),
    ).toBeInTheDocument();
  });

  it('shows the INTERNAL_SERVER_ERROR error message', async () => {
    renderRoute('/login?error=INTERNAL_SERVER_ERROR');
    expect(
      await screen.findByText(/서버 오류가 발생했습니다/),
    ).toBeInTheDocument();
  });

  it('shows a generic error message for unknown error codes', async () => {
    renderRoute('/login?error=TOTALLY_UNKNOWN_CODE');
    expect(
      await screen.findByText(
        '예상치 못한 오류가 발생했습니다. 다시 시도해주세요.',
      ),
    ).toBeInTheDocument();
  });

  it('clicking the Google login button sets loading state and stores redirect path', async () => {
    const user = userEvent.setup();

    // window.location.assign is a non-configurable property in jsdom; we verify side effects
    renderRoute('/login?next=%2Fjob-postings%2F1');
    await user.click(
      await screen.findByRole('button', { name: /Google로 계속하기/i }),
    );

    // storeRedirectPath is called before window.location.assign
    expect(sessionStorage.getItem('career-os-auth-return-to')).toBe(
      '/job-postings/1',
    );
  });
});
