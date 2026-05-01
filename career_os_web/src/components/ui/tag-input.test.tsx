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

  it('adds a tag when Enter is pressed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />);

    await user.type(screen.getByRole('textbox'), 'React');
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith(['React']);
  });

  it('adds a tag when comma is pressed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />);

    await user.type(screen.getByRole('textbox'), 'Vue,');

    expect(onChange).toHaveBeenCalledWith(['Vue']);
  });

  it('removes the last tag when Backspace is pressed on an empty input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput value={['React', 'TypeScript']} onChange={onChange} />);

    await user.click(screen.getByRole('textbox'));
    await user.keyboard('{Backspace}');

    expect(onChange).toHaveBeenCalledWith(['React']);
  });

  it('adds pending input as a tag on blur', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />);

    await user.type(screen.getByRole('textbox'), 'Vue');
    await user.tab();

    expect(onChange).toHaveBeenCalledWith(['Vue']);
  });

  it('does not add a duplicate tag', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput value={['React']} onChange={onChange} />);

    await user.type(screen.getByRole('textbox'), 'React');
    await user.keyboard('{Enter}');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('trims whitespace from input before adding as a tag', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />);

    await user.type(screen.getByRole('textbox'), '  React  ');
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith(['React']);
  });

  it('updates input value as the user types', async () => {
    const user = userEvent.setup();
    render(<TagInput value={[]} onChange={vi.fn()} />);

    await user.type(screen.getByRole('textbox'), 'Type');

    expect(screen.getByRole('textbox')).toHaveValue('Type');
  });

  it('clears the input after a tag is added', async () => {
    const user = userEvent.setup();
    render(<TagInput value={[]} onChange={vi.fn()} />);

    await user.type(screen.getByRole('textbox'), 'React');
    await user.keyboard('{Enter}');

    expect(screen.getByRole('textbox')).toHaveValue('');
  });
});
