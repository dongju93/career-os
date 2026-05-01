import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouteError } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { RouteErrorBoundary } from './route-error-boundary';

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useRouteError: vi.fn(),
  };
});

const mockUseRouteError = vi.mocked(useRouteError);

describe('RouteErrorBoundary', () => {
  it('shows generic title and description for unknown errors', () => {
    mockUseRouteError.mockReturnValue(new TypeError('something broke'));
    render(<RouteErrorBoundary />);
    expect(
      screen.getByRole('heading', { name: '예기치 않은 오류가 발생했습니다' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('잠시 후 다시 시도하거나, 홈으로 돌아가세요.'),
    ).toBeInTheDocument();
  });

  it('shows status and statusText for route error responses', () => {
    mockUseRouteError.mockReturnValue({
      status: 404,
      statusText: 'Not Found',
      internal: false,
      data: '요청한 페이지가 없습니다',
    });
    render(<RouteErrorBoundary />);
    expect(
      screen.getByRole('heading', { name: '404 Not Found' }),
    ).toBeInTheDocument();
    expect(screen.getByText('요청한 페이지가 없습니다')).toBeInTheDocument();
  });

  it('uses fallback description when route error data is not a string', () => {
    mockUseRouteError.mockReturnValue({
      status: 500,
      statusText: 'Internal Server Error',
      internal: true,
      data: { detail: 'non-string data' },
    });
    render(<RouteErrorBoundary />);
    expect(
      screen.getByText('잠시 후 다시 시도하거나, 홈으로 돌아가세요.'),
    ).toBeInTheDocument();
  });

  it('renders refresh and home buttons', () => {
    mockUseRouteError.mockReturnValue(null);
    render(<RouteErrorBoundary />);
    expect(
      screen.getByRole('button', { name: '페이지 새로고침' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '홈으로 돌아가기' }),
    ).toBeInTheDocument();
  });

  it('clicking the refresh button does not throw', async () => {
    const user = userEvent.setup();
    mockUseRouteError.mockReturnValue(null);
    render(<RouteErrorBoundary />);
    // window.location.reload is a no-op in jsdom; just verify no exception is raised
    await user.click(screen.getByRole('button', { name: '페이지 새로고침' }));
  });

  it('clicking the home button does not throw', async () => {
    const user = userEvent.setup();
    mockUseRouteError.mockReturnValue(null);
    render(<RouteErrorBoundary />);
    // window.location.href assignment is a no-op in jsdom; just verify no exception is raised
    await user.click(screen.getByRole('button', { name: '홈으로 돌아가기' }));
  });
});
