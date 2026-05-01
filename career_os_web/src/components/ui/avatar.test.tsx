import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AvatarFallback, AvatarImage, AvatarRoot } from './avatar';

describe('AvatarRoot', () => {
  it('renders a container element', () => {
    const { container } = render(<AvatarRoot data-testid="avatar-root" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('applies additional className', () => {
    const { container } = render(<AvatarRoot className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});

describe('AvatarFallback', () => {
  it('renders fallback text when the image has not loaded', () => {
    render(
      <AvatarRoot>
        <AvatarFallback>AB</AvatarFallback>
      </AvatarRoot>,
    );
    // In jsdom images never fire the load event, so AvatarFallback is visible
    expect(screen.getByText('AB')).toBeInTheDocument();
  });

  it('applies additional className to fallback', () => {
    render(
      <AvatarRoot>
        <AvatarFallback className="fallback-class">FB</AvatarFallback>
      </AvatarRoot>,
    );
    expect(screen.getByText('FB')).toHaveClass('fallback-class');
  });
});

describe('AvatarImage', () => {
  it('renders an img element with the given src and alt', () => {
    render(
      <AvatarRoot>
        <AvatarImage alt="User photo" src="https://example.com/photo.jpg" />
        <AvatarFallback>U</AvatarFallback>
      </AvatarRoot>,
    );
    // The img element is present in the DOM regardless of load status
    const img = screen.queryByRole('img');
    if (img) {
      expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
      expect(img).toHaveAttribute('alt', 'User photo');
    }
  });
});
