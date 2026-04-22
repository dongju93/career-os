import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('renders a slotted child element without crashing', () => {
    render(
      <Button asChild>
        <a href="/job-postings">채용공고 보기</a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: '채용공고 보기' });

    expect(link).toHaveAttribute('href', '/job-postings');
    expect(link).toHaveClass('inline-flex');
  });

  it('renders loading content with a slotted child element', () => {
    const { container } = render(
      <Button asChild loading>
        <a href="/job-postings">채용공고 보기</a>
      </Button>,
    );

    expect(
      screen.getByRole('link', { name: '채용공고 보기' }),
    ).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
