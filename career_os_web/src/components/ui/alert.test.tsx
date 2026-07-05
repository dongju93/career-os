import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Alert, AlertDescription } from './alert';

describe('Alert', () => {
  it('announces error-class variants assertively', () => {
    render(
      <Alert variant="destructive">
        <AlertDescription>저장 실패</AlertDescription>
      </Alert>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });

  it('announces informational variants politely via role=status', () => {
    render(
      <Alert variant="success">
        <AlertDescription>저장했습니다.</AlertDescription>
      </Alert>,
    );

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    // Success is not an assertive alert.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lets callers override the derived politeness', () => {
    render(
      <Alert variant="destructive" role="status" aria-live="polite">
        <AlertDescription>덜 급한 알림</AlertDescription>
      </Alert>,
    );

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });
});
