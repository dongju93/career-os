import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LiveRegion } from './live-region';

describe('LiveRegion', () => {
  it('defaults to a polite status region', () => {
    render(<LiveRegion>저장 중…</LiveRegion>);

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
    expect(region).toHaveTextContent('저장 중…');
  });

  it('renders an assertive alert region when politeness is assertive', () => {
    render(<LiveRegion politeness="assertive">오류</LiveRegion>);

    const region = screen.getByRole('alert');
    expect(region).toHaveAttribute('aria-live', 'assertive');
  });

  it('stays mounted (and empty) when idle so later messages are announced', () => {
    render(<LiveRegion>{''}</LiveRegion>);

    const region = screen.getByRole('status');
    expect(region).toBeEmptyDOMElement();
  });
});
