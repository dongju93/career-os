import {
  Briefcase,
  ChevronRight,
  FolderOpen,
  LogOut,
  Menu,
  PlusCircle,
  Sparkles,
  UserCircle,
  X,
} from 'lucide-react';
import { Suspense, useEffect, useId, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { cn } from '@/lib/utils';
import { logoutUser } from '../services/auth';
import { resetAuthStore, useAuthStore } from '../store/auth-store';
import { ChatKitFloatingAssistant } from './chatkit-floating-assistant';
import { AvatarFallback, AvatarImage, AvatarRoot } from './ui/avatar';
import { Button } from './ui/button';

const navigationItems = [
  {
    href: '/job-postings',
    icon: Briefcase,
    label: '채용공고',
    description: '저장한 채용공고 관리',
  },
  {
    href: '/job-search-groups',
    icon: FolderOpen,
    label: '구직 활동',
    description: '구직 그룹 관리',
  },
  {
    href: '/job-postings/new',
    icon: PlusCircle,
    label: '채용공고 등록',
    description: '새 URL 스크랩 및 저장',
  },
  {
    href: '/profile',
    icon: UserCircle,
    label: '프로필',
    description: '내 경력 정보 관리',
  },
  {
    href: '/strategist',
    icon: Sparkles,
    label: '지원 전략',
    description: 'AI 지원 전략 플랜',
  },
];

function UserInitials(name: string | null, email: string | null): string {
  const source = name ?? email ?? 'U';
  return source.charAt(0).toUpperCase();
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  async function handleLogout() {
    await logoutUser().catch(() => {});
    resetAuthStore();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-full flex-col p-5">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary to-teal-400 text-sm font-black text-slate-900 shadow-lg shadow-primary/30">
          CO
        </div>
        <div>
          <span className="block text-lg font-bold tracking-tight">
            Career OS
          </span>
          <span className="block text-xs text-gray-600">채용 관리 시스템</span>
        </div>
        {/* The drawer is a modal <dialog>, so the background header toggle is
            inert while it is open — the close affordance must live inside. */}
        {onClose && (
          <button
            aria-label="메뉴 닫기"
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navigationItems.map(({ href, icon: Icon, label, description }) => (
          <NavLink
            key={href}
            end
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 no-underline transition-all duration-200',
                isActive
                  ? 'bg-primary/15 text-primary border border-primary/20'
                  : 'text-gray-600 hover:bg-muted hover:text-foreground border border-transparent',
              )
            }
            to={href}
            onClick={onClose}
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary text-slate-900 shadow-sm'
                      : 'bg-muted text-gray-600 group-hover:bg-white/10 group-hover:text-primary',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{label}</div>
                  <div
                    className={cn(
                      'text-xs',
                      isActive ? 'text-primary/70' : 'text-gray-500',
                    )}
                  >
                    {description}
                  </div>
                </div>
                <ChevronRight
                  className={cn(
                    'h-4 w-4 transition-all',
                    isActive
                      ? 'translate-x-0 opacity-100 text-primary'
                      : '-translate-x-1 opacity-0',
                  )}
                />
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-4">
        {user && (
          <div className="flex items-center gap-3 rounded-xl border-white/12 bg-muted p-3">
            <AvatarRoot>
              {user.picture && (
                <AvatarImage
                  alt={user.name ?? ''}
                  referrerPolicy="no-referrer"
                  src={user.picture}
                />
              )}
              <AvatarFallback>
                {UserInitials(user.name, user.email)}
              </AvatarFallback>
            </AvatarRoot>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {user.name ?? user.email}
              </div>
              {user.name && (
                <div className="text-xs text-gray-500 truncate">
                  {user.email}
                </div>
              )}
            </div>
            <Button
              className="shrink-0"
              size="icon"
              variant="ghost"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">로그아웃</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useAuthStore((state) => state.user);

  const userInitial = UserInitials(user?.name ?? null, user?.email ?? null);

  const drawerRef = useRef<HTMLDialogElement>(null);
  const drawerId = useId();

  // Drive the native <dialog> imperatively. showModal() gives us a focus trap,
  // an inert background, Esc-to-close, and focus restoration to the trigger for
  // free. jsdom (the test env) ships no showModal()/close(), so fall back to
  // toggling the `open` property there.
  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    if (mobileOpen) {
      if (drawer.open) return;
      if (typeof drawer.showModal === 'function') drawer.showModal();
      else drawer.open = true;
    } else if (drawer.open) {
      if (typeof drawer.close === 'function') drawer.close();
      else drawer.open = false;
    }
  }, [mobileOpen]);

  // The modal backdrop blocks pointer input but not scrolling of the page
  // behind it, so pin body overflow while the drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Skip link — first focusable element; jumps keyboard/AT users past the
          sidebar nav straight to page content. Hidden until focused. */}
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-lg"
        href="#main-content"
      >
        본문으로 건너뛰기
      </a>

      {/* Ambient background blobs — visible through glass */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-linear-to-br from-cyan-400/40 via-primary/25 to-transparent blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-[-6rem] h-96 w-96 rounded-full bg-linear-to-tr from-teal-400/35 via-primary/20 to-transparent blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[30%] right-[10%] h-72 w-72 rounded-full bg-linear-to-br from-purple-500/30 to-pink-500/20 blur-3xl"
      />

      {/* Sidebar — glass-strong, background blur clearly visible */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col rounded-r-3xl border-r border glass-strong md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile header — glass-strong */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border px-4 glass-strong md:hidden">
        <Button
          aria-controls={drawerId}
          aria-expanded={mobileOpen}
          aria-haspopup="dialog"
          size="icon"
          variant="ghost"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">메뉴 열기</span>
        </Button>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-primary to-teal-400 text-xs font-black text-slate-900 shadow-md shadow-primary/30">
            CO
          </div>
          <span className="text-base font-bold tracking-tight">Career OS</span>
        </div>

        <AvatarRoot className="h-8 w-8">
          {user?.picture && (
            <AvatarImage
              alt={user.name ?? ''}
              referrerPolicy="no-referrer"
              src={user.picture}
            />
          )}
          <AvatarFallback className="text-xs">{userInitial}</AvatarFallback>
        </AvatarRoot>
      </header>

      {/* Mobile sidebar — native modal <dialog>. showModal() supplies the focus
          trap, inert background, Esc-to-close, and trigger focus restoration;
          we only add backdrop-click dismissal and body scroll lock. Rendered
          in the top layer, so it needs no z-index. Content is mounted only
          while open to avoid a second nav tree in the accessibility flow. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop-click is a
          mouse-only convenience; the keyboard dismiss path is the modal
          dialog's native Esc handling from showModal(). */}
      <dialog
        ref={drawerRef}
        aria-label="주요 메뉴"
        className="fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-64 max-w-[80vw] rounded-r-3xl border-r border p-0 glass-strong backdrop:bg-black/20 backdrop:backdrop-blur-sm md:hidden"
        id={drawerId}
        onClick={(event) => {
          // A click whose target is the dialog element itself (not its
          // content) landed on the ::backdrop — dismiss the drawer.
          if (event.target === drawerRef.current) setMobileOpen(false);
        }}
        onClose={() => setMobileOpen(false)}
      >
        {mobileOpen && <SidebarContent onClose={() => setMobileOpen(false)} />}
      </dialog>

      {/* Main content — pages float on the vibrant background */}
      <main
        className="relative md:pl-64 outline-none"
        id="main-content"
        tabIndex={-1}
      >
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
          <Suspense
            fallback={
              <div className="flex h-64 items-center justify-center text-sm text-gray-500">
                로딩 중…
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </main>

      <ChatKitFloatingAssistant />
    </div>
  );
}
