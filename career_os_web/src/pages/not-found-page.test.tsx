import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { NotFoundPage } from './not-found-page';

describe('NotFoundPage', () => {
  it('renders heading, description, and home link', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: '페이지를 찾을 수 없습니다' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('요청하신 페이지가 존재하지 않거나 이동되었습니다'),
    ).toBeInTheDocument();

    const homeLink = screen.getByRole('link', { name: /홈으로 돌아가기/i });
    expect(homeLink).toHaveAttribute('href', '/job-postings');
  });
});
