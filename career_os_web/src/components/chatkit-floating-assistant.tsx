import { ChatKit, useChatKit } from '@openai/chatkit-react';
import { History, MessageCircle, MessageCirclePlus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  chatKitFetch,
  getChatKitApiUrl,
  getChatKitDomainKey,
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
const HEADER_ACTION_CLASS =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

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
          onClick={handleOpen}
          className={cn(
            'fixed right-4 bottom-4 z-60 flex h-13 w-13 items-center justify-center rounded-full bg-linear-to-br from-primary to-teal-400 text-primary-foreground shadow-lg shadow-primary/30 transition-transform duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'md:right-6 md:bottom-6 md:h-14 md:w-14',
          )}
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {hasOpened && (
        <div
          role="dialog"
          aria-label="AI 어시스턴트"
          className={cn(
            'glass-strong fixed z-60 flex flex-col overflow-hidden rounded-2xl',
            'inset-x-3 top-16 bottom-3',
            'md:inset-x-auto md:top-auto md:right-6 md:bottom-6 md:h-[min(680px,calc(100vh-6rem))] md:w-[min(420px,calc(100vw-2rem))]',
            !open && 'hidden',
          )}
        >
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <h2 className="text-sm font-bold tracking-tight">AI 어시스턴트</h2>
            <div className="flex items-center gap-1">
              <button
                ref={firstActionRef}
                type="button"
                aria-label="새 채팅"
                onClick={handleNewChat}
                className={HEADER_ACTION_CLASS}
              >
                <MessageCirclePlus className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="이전 채팅"
                onClick={handleShowHistory}
                className={HEADER_ACTION_CLASS}
              >
                <History className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setOpen(false)}
                className={HEADER_ACTION_CLASS}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <ChatKit control={control} className="h-full w-full" />
          </div>
        </div>
      )}
    </>
  );
}
