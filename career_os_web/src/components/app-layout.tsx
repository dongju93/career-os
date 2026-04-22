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
    <div className="flex flex-col h-full p-6">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2 mb-8">
        <div className="h-10 w-10 rounded-xl bg-linear-to-br from-primary to-teal-600 text-white font-bold text-sm flex items-center justify-center shadow-lg">
          CO
        </div>
        <div>
          <span className="text-lg font-bold tracking-tight block">
            Career OS
          </span>
          <span className="text-xs text-muted-foreground block">
            채용 관리 시스템
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 flex-1">
        {navigationItems.map(({ href, icon: Icon, label, description }) => (
          <NavLink
            key={href}
            end
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 no-underline',
                isActive
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
            to={href}
            onClick={onClose}
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                    isActive ? 'bg-primary text-white' : 'bg-muted/50',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{label}</div>
                  <div
                    className={cn(
                      'text-xs',
                      isActive ? 'text-primary/70' : 'text-muted-foreground',
                    )}
                  >
                    {description}
                  </div>
                </div>
                <ChevronRight
                  className={cn(
                    'h-4 w-4 transition-opacity',
                    isActive ? 'opacity-100' : 'opacity-0',
                  )}
                />
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="mt-auto pt-4 border-t border-border/50">
        {user && (
          <div className="flex items-center gap-3 mb-3">
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
                <div className="text-xs text-muted-foreground truncate">
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
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-50 w-72 glass-card rounded-r-3xl flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-40 h-16 glass-subtle border-b border-white/30 flex items-center justify-between px-4">
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
          <div className="h-7 w-7 rounded-lg bg-linear-to-br from-primary to-teal-600 text-white font-bold text-xs flex items-center justify-center">
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
            className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="md:hidden fixed inset-y-0 left-0 z-50 w-72 glass-card flex flex-col">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="md:pl-72">
        <div className="max-w-6xl mx-auto px-4 py-6 md:px-8 md:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
