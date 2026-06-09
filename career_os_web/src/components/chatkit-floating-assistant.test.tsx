import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/auth-store';
import { ChatKitFloatingAssistant } from './chatkit-floating-assistant';

// Shared control-method spies. `vi.hoisted` lets the hoisted `vi.mock` factory
// reference them without a temporal-dead-zone error.
const chatkitMocks = vi.hoisted(() => ({
  setThreadId: vi.fn(),
  showHistory: vi.fn(),
  hideHistory: vi.fn(),
  focusComposer: vi.fn(),
}));

// Captures the options passed to `useChatKit` so tests can assert on our
// configuration without coupling to ChatKit's internal UI.
const capturedChatKitOptions = vi.hoisted(() => ({
  current: null as { startScreen?: { prompts?: unknown[] } } | null,
}));

// ChatKit renders an opaque embed; mock the binding so tests cover only our
// shell and the control wiring, not ChatKit's internal UI.
vi.mock('@openai/chatkit-react', () => ({
  useChatKit: (options: { startScreen?: { prompts?: unknown[] } }) => {
    capturedChatKitOptions.current = options;
    return { control: {}, ...chatkitMocks };
  },
  ChatKit: () => <div data-testid="chatkit-embed" />,
}));

const LAUNCHER_LABEL = 'AI 어시스턴트 열기';

function signIn() {
  useAuthStore.getState().setAuth({
    id: 'user-1',
    email: 'user@example.com',
    name: 'Career OS User',
    picture: null,
  });
}

async function openPanel() {
  await userEvent.click(screen.getByRole('button', { name: LAUNCHER_LABEL }));
}

describe('ChatKitFloatingAssistant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no user is signed in', () => {
    render(<ChatKitFloatingAssistant />);
    expect(screen.queryByRole('button', { name: LAUNCHER_LABEL })).toBeNull();
  });

  it('shows the launcher for an authenticated user', () => {
    signIn();
    render(<ChatKitFloatingAssistant />);
    expect(
      screen.getByRole('button', { name: LAUNCHER_LABEL }),
    ).toBeInTheDocument();
  });

  it('opens the panel and mounts the ChatKit embed when the launcher is clicked', async () => {
    signIn();
    render(<ChatKitFloatingAssistant />);
    await openPanel();

    expect(
      screen.getByRole('dialog', { name: 'AI 어시스턴트' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('chatkit-embed')).toBeInTheDocument();
    // The launcher is replaced by the open panel.
    expect(screen.queryByRole('button', { name: LAUNCHER_LABEL })).toBeNull();
  });

  it('closes the panel via the close button', async () => {
    signIn();
    render(<ChatKitFloatingAssistant />);
    await openPanel();
    await userEvent.click(screen.getByRole('button', { name: '닫기' }));

    expect(
      screen.getByRole('button', { name: LAUNCHER_LABEL }),
    ).toBeInTheDocument();
  });

  it('closes the panel with the Escape key', async () => {
    signIn();
    render(<ChatKitFloatingAssistant />);
    await openPanel();
    await userEvent.keyboard('{Escape}');

    expect(
      screen.getByRole('button', { name: LAUNCHER_LABEL }),
    ).toBeInTheDocument();
  });

  it('starts a new chat by clearing the active thread', async () => {
    signIn();
    render(<ChatKitFloatingAssistant />);
    await openPanel();
    await userEvent.click(screen.getByRole('button', { name: '새 채팅' }));

    expect(chatkitMocks.setThreadId).toHaveBeenCalledWith(null);
  });

  it('configures non-empty starter prompts on the start screen', () => {
    signIn();
    render(<ChatKitFloatingAssistant />);

    const prompts = capturedChatKitOptions.current?.startScreen?.prompts;
    expect(prompts).toBeDefined();
    expect(prompts?.length).toBeGreaterThan(0);
  });

  it('opens the history view via showHistory()', async () => {
    signIn();
    render(<ChatKitFloatingAssistant />);
    await openPanel();
    await userEvent.click(screen.getByRole('button', { name: '이전 채팅' }));

    expect(chatkitMocks.showHistory).toHaveBeenCalledTimes(1);
  });
});
