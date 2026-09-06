import * as stylex from '@stylexjs/stylex';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Alert, AlertDescription } from './alert';
import { Button } from './button';
import { CardContent } from './card';

const styles = stylex.create({
  override: { height: '3rem', paddingLeft: '2rem' },
  buttonDefault: { height: '2.5rem', paddingLeft: '1.25rem' },
  cardDefault: { paddingTop: '0rem', paddingRight: '1.5rem' },
});

function classes(style: stylex.StyleXStyles) {
  return stylex.props(style).className?.split(' ').filter(Boolean) ?? [];
}

describe('StyleX component composition', () => {
  it('applies caller overrides and removes conflicting button defaults', () => {
    render(<Button xstyle={styles.override}>저장</Button>);
    const button = screen.getByRole('button', { name: '저장' });
    expect(button).toHaveClass(...classes(styles.override));
    for (const className of classes(styles.buttonDefault)) {
      expect(button).not.toHaveClass(className);
    }
  });

  it('preserves unrelated card padding when overriding one side', () => {
    render(<CardContent data-testid="content" xstyle={styles.override} />);
    const content = screen.getByTestId('content');
    expect(content).toHaveClass(...classes(styles.override));
    expect(content).toHaveClass(...classes(styles.cardDefault));
    expect(content).not.toHaveAttribute('xstyle');
  });

  it('keeps the slotted link styled while forwarding its identity', () => {
    render(
      <Button asChild xstyle={styles.override}>
        <a href="/profile">프로필</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: '프로필' });
    expect(link).toHaveAttribute('href', '/profile');
    expect(link).toHaveClass(...classes(styles.override));
  });

  it('renders the explicit decorative icon without changing alert semantics', () => {
    render(
      <Alert variant="destructive" icon={<svg data-testid="icon" />}>
        <AlertDescription>저장 실패</AlertDescription>
      </Alert>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('저장 실패');
    expect(screen.getByTestId('icon').parentElement).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});
