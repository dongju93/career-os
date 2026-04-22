import {
  Briefcase,
  ChevronRight,
  LogOut,
  Menu,
  PlusCircle,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { cn } from '@/lib/utils';
import { logoutUser } from '../services/auth';
import { useAuthStore } from '../store/auth-store';
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
    href: '/job-postings/new',
    icon: PlusCircle,
    label: '채용공고 등록',
    description: '새 URL 스크랩 및 저장',
  },
];

function UserInitials(name: string | null, email: string | null): string {
  const source = name ?? email ?? 'U';
  return source.charAt(0).toUpperCase();
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  async function handleLogout() {
    if (token) {
      await logoutUser(token).catch(() => {});
    }
    clearAuth();
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

  return (
    <div className="relative min-h-screen overflow-hidden">
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
          size="icon"
          variant="ghost"
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
          <span className="sr-only">메뉴</span>
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

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col rounded-r-3xl border-r border glass-strong md:hidden">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      {/* Main content — pages float on the vibrant background */}
      <main className="relative md:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
