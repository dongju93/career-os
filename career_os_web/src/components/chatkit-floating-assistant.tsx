import { ChatKit, useChatKit } from '@openai/chatkit-react';
import * as stylex from '@stylexjs/stylex';
import { History, MessageCircle, MessageCirclePlus, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { surfaces } from '@/styles/surfaces';
import {
  chatKitFetch,
  getChatKitApiUrl,
  getChatKitDomainKey,
  loadChatKitScript,
} from '../services/chatkit';
import { useAuthStore } from '../store/auth-store';

/**
 * Floating AI assistant.
 *
 * We hand-build only the *shell* — launcher, glass panel, header, and the
 * open/close + focus + ESC behaviour. The chat interior (messages, composer,
 * history list, delete/streaming) is rendered by `<ChatKit>` and configured
 * through `useChatKit` options + theme + `ko-KR` locale, not our own markup.
 *
 * Mounted inside `AppLayout`, which already lives under `ProtectedRoute`, so a
 * lightweight `user` render-guard (not a separate route gate) is enough to keep
 * the launcher logged-in-only and make it disappear on logout.
 */

// Shared styling for the three header icon buttons. We use native <button>
// elements (not the <Button> primitive) because the new-chat button needs a
// forwarded ref for focus management, and <Button> does not forward refs.

export function ChatKitFloatingAssistant() {
  const user = useAuthStore((state) => state.user);

  const [open, setOpen] = useState(false);
  // Mount <ChatKit> lazily on first open, then keep it alive (hidden via CSS)
  // so the active thread and loaded state survive close/reopen within a session
  // without eagerly loading the embed on every authenticated page.
  const [hasOpened, setHasOpened] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const launcherRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const prevOpenRef = useRef(false);
  const panelId = useId();

  const { control, focusComposer, setThreadId, showHistory, hideHistory } =
    useChatKit({
      api: {
        url: getChatKitApiUrl(),
        domainKey: getChatKitDomainKey(),
        fetch: chatKitFetch,
      },
      header: { enabled: false },
      history: { enabled: true, showDelete: true, showRename: false },
      startScreen: {
        greeting: '새 대화',
        prompts: [
          {
            label: '최근 저장 공고 비교',
            prompt: '최근에 저장한 공고들을 비교해줘',
          },
          {
            label: '지원 우선순위 정리',
            prompt: '저장한 공고들로 지원 우선순위를 정해줘',
          },
          {
            label: '저장 공고에서 찾기',
            prompt: '저장한 공고 중 신입 지원 가능한 공고를 찾아줘',
          },
        ],
      },
      composer: { placeholder: '무엇을 도와드릴까요?' },
      locale: 'ko-KR',
      theme: {
        colorScheme: 'light',
        radius: 'round',
        color: { accent: { primary: 'hsl(185 72% 42%)', level: 2 } },
      },
      // Selecting a thread (or starting a new one) closes ChatKit's history
      // panel; keep our flag in sync so ESC targets the right thing.
      onThreadChange: () => setHistoryOpen(false),
    });

  // Move focus into the panel on open and back to the launcher on close.
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;
    if (open) {
      firstActionRef.current?.focus();
    } else if (wasOpen) {
      launcherRef.current?.focus();
    }
  }, [open]);

  // ESC closes the history view first, otherwise the panel.
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (historyOpen) {
        void hideHistory();
        setHistoryOpen(false);
      } else {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, historyOpen, hideHistory]);

  if (!user) return null;

  function handleOpen() {
    // Pull in the ChatKit CDN script on demand. Kept unconditional (not gated
    // on `hasOpened`): it is a no-op after a successful load and lets a failed
    // load retry on reopen. `<ChatKit>` waits for the custom element, so it is
    // safe whether this resolves before or after the embed mounts below.
    void loadChatKitScript().catch(() => {
      // A CDN failure leaves ChatKit waiting for its custom element rather than
      // crashing the app; the failed request is still visible to Sentry.
    });
    setHasOpened(true);
    setOpen(true);
  }

  async function handleNewChat() {
    setHistoryOpen(false);
    await setThreadId(null);
    await focusComposer();
  }

  async function handleShowHistory() {
    await showHistory();
    setHistoryOpen(true);
  }

  return (
    <>
      {!open && (
        <button
          ref={launcherRef}
          type="button"
          aria-label="AI 어시스턴트 열기"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={hasOpened ? panelId : undefined}
          onClick={handleOpen}
          {...stylex.props([styles.launcher, styles.launcherViewport])}
        >
          <MessageCircle {...stylex.props(styles.launcherIcon)} />
        </button>
      )}

      {/* Intentionally a NON-modal dialog: as a persistent corner assistant it
          must leave the page interactive/scrollable while open, and its body is
          a third-party embed we cannot honestly focus-trap. So: no `aria-modal`,
          no background inert. Keyboard support is ESC-to-close + focus restore
          (below); the launcher exposes aria-expanded/aria-controls. */}
      {hasOpened && (
        <div
          id={panelId}
          role="dialog"
          aria-label="AI 어시스턴트"
          {...stylex.props([
            styles.panel,
            surfaces.glassStrong,
            styles.panelMobile,
            styles.panelViewport,
            !open && styles.hidden,
          ])}
        >
          <div {...stylex.props(styles.header)}>
            <h2 {...stylex.props(styles.heading)}>AI 어시스턴트</h2>
            <div {...stylex.props(styles.actions)}>
              <button
                ref={firstActionRef}
                type="button"
                aria-label="새 채팅"
                onClick={handleNewChat}
                {...stylex.props(headerActionStyle)}
              >
                <MessageCirclePlus {...stylex.props(styles.icon2)} />
              </button>
              <button
                type="button"
                aria-label="이전 채팅"
                onClick={handleShowHistory}
                {...stylex.props(headerActionStyle)}
              >
                <History {...stylex.props(styles.icon2)} />
              </button>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setOpen(false)}
                {...stylex.props(headerActionStyle)}
              >
                <X {...stylex.props(styles.icon2)} />
              </button>
            </div>
          </div>

          <div {...stylex.props(styles.body)}>
            <ChatKit control={control} {...stylex.props(styles.icon3)} />
          </div>
        </div>
      )}
    </>
  );
}

const styles = stylex.create({
  headerAction: {
    display: 'inline-flex',
    height: '2rem',
    width: '2rem',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '.5rem',
    color: {
      default: 'hsl(var(--muted-foreground))',
      ':hover': 'hsl(var(--foreground))',
    },
    transitionProperty:
      'color, background-color, border-color, outline-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
    backgroundColor: {
      default: null,
      ':hover': 'color-mix(in oklab, #000 5%, transparent)',
    },
    outlineStyle: {
      default: null,
      ':focus-visible': 'solid',
    },
    outlineWidth: {
      default: null,
      ':focus-visible': '2px',
    },
    outlineColor: {
      default: null,
      ':focus-visible': 'hsl(var(--ring))',
    },
    outlineOffset: {
      default: null,
      ':focus-visible': '0px',
    },
  },
  launcher: {
    position: 'fixed',
    right: '1rem',
    bottom: '1rem',
    zIndex: 60,
    display: 'flex',
    height: '3.25rem',
    width: '3.25rem',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '9999px',
    backgroundImage:
      'linear-gradient(to bottom right in oklab, hsl(var(--primary)), oklch(77.7% .152 181.912))',
    color: 'hsl(var(--primary-foreground))',
    boxShadow:
      '0 10px 15px -3px color-mix(in oklab, hsl(var(--primary)) 30%, transparent), 0 4px 6px -4px color-mix(in oklab, hsl(var(--primary)) 30%, transparent)',
    transitionProperty: 'transform, translate, scale, rotate',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '200ms',
    scale: {
      default: null,
      ':hover': '1.05',
      ':active': '0.95',
    },
    outlineStyle: {
      default: null,
      ':focus-visible': 'solid',
    },
    outlineWidth: {
      default: null,
      ':focus-visible': '2px',
    },
    outlineColor: {
      default: null,
      ':focus-visible': 'hsl(var(--ring))',
    },
    outlineOffset: {
      default: null,
      ':focus-visible': '2px',
    },
  },
  launcherViewport: {
    right: {
      default: '1rem',
      '@media (min-width: 48rem)': '1.5rem',
    },
    bottom: {
      default: '1rem',
      '@media (min-width: 48rem)': '1.5rem',
    },
    height: {
      default: '3.25rem',
      '@media (min-width: 48rem)': '3.5rem',
    },
    width: {
      default: '3.25rem',
      '@media (min-width: 48rem)': '3.5rem',
    },
  },
  launcherIcon: {
    height: '1.5rem',
    width: '1.5rem',
  },
  panel: {
    position: 'fixed',
    zIndex: 60,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: '1rem',
  },
  panelMobile: {
    top: '4rem',
    bottom: '0.75rem',
    left: '0.75rem',
    right: '0.75rem',
  },
  panelViewport: {
    top: {
      default: '4rem',
      '@media (min-width: 48rem)': 'auto',
    },
    bottom: {
      default: '0.75rem',
      '@media (min-width: 48rem)': '1.5rem',
    },
    left: {
      default: '0.75rem',
      '@media (min-width: 48rem)': 'auto',
    },
    right: {
      default: '0.75rem',
      '@media (min-width: 48rem)': '1.5rem',
    },
    height: {
      default: null,
      '@media (min-width: 48rem)': 'min(680px,calc(100vh-6rem))',
    },
    width: {
      default: null,
      '@media (min-width: 48rem)': 'min(420px,calc(100vw-2rem))',
    },
  },
  hidden: {
    display: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: '1px',
    borderColor: 'color-mix(in oklab, hsl(var(--border)) 60%, transparent)',
    paddingLeft: '1rem',
    paddingRight: '1rem',
    paddingTop: '0.75rem',
    paddingBottom: '0.75rem',
  },
  heading: {
    fontSize: '.875rem',
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: '-.02em',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  icon2: {
    height: '1rem',
    width: '1rem',
  },
  body: {
    minHeight: '0rem',
    flex: '1',
  },
  icon3: {
    height: '100%',
    width: '100%',
  },
});

const headerActionStyle = styles.headerAction;
