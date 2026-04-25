import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TagInput } from './tag-input';

describe('TagInput', () => {
  it('remove button has an accessible name that includes the tag value', () => {
    render(<TagInput value={['React', 'TypeScript']} onChange={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: 'React 제거' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'TypeScript 제거' }),
    ).toBeInTheDocument();
  });

  it('calls onChange without the removed tag when remove button is clicked', async () => {
    const onChange = vi.fn();
    render(<TagInput value={['React', 'TypeScript']} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'React 제거' }));

    expect(onChange).toHaveBeenCalledWith(['TypeScript']);
  });
});
