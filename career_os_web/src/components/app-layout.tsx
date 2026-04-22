import {
  Briefcase,
  ChevronRight,
  LogOut,
  Menu,
  PlusCircle,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink as RouterNavLink, Outlet, useNavigate } from 'react-router';
import { logoutUser } from '@/services/auth';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const navigationItems = [
  {
    to: '/job-postings',
    label: '채용공고',
    description: '저장한 채용공고 관리',
    icon: Briefcase,
  },
  {
    to: '/job-postings/new',
    label: '채용공고 등록',
    description: '새 URL 스크랩 및 저장',
    icon: PlusCircle,
  },
];

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const userInitial = (user?.name ?? user?.email ?? 'U')
    .charAt(0)
    .toUpperCase();

  return (
    <div className="min-h-screen">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-out md:translate-x-0',
          'glass-card border-r-0 rounded-none md:rounded-r-3xl',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-teal-600 text-white font-bold text-sm shadow-lg shadow-primary/25">
                CO
              </div>
              <span className="text-lg font-bold tracking-tight">Career OS</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-4">
            {navigationItems.map((item) => (
              <RouterNavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200',
                    isActive
                      ? 'bg-primary/10 text-primary shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                        isActive
                          ? 'bg-primary text-white'
                          : 'bg-muted/50 text-muted-foreground group-hover:bg-accent group-hover:text-foreground'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{item.label}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.description}
                      </div>
                    </div>
                    <ChevronRight
                      className={cn(
                        'h-4 w-4 opacity-0 transition-all',
                        isActive && 'opacity-100'
                      )}
                    />
                  </>
                )}
              </RouterNavLink>
            ))}
          </nav>

          {/* User Section */}
          <div className="p-4 space-y-3">
            <Separator />
            {user && (
              <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
                <Avatar className="h-9 w-9">
                  {user.picture ? (
                    <AvatarImage
                      src={user.picture}
                      alt={user.name ?? ''}
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <AvatarFallback>{userInitial}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {user.name ?? user.email}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </div>
                </div>
              </div>
            )}
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              로그아웃
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="md:pl-72">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 glass-subtle md:hidden">
          <div className="flex h-16 items-center justify-between px-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-teal-600 text-white font-bold text-xs">
                CO
              </div>
              <span className="font-bold">Career OS</span>
            </div>
            {user && (
              <Avatar className="h-8 w-8">
                {user.picture ? (
                  <AvatarImage
                    src={user.picture}
                    alt={user.name ?? ''}
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                <AvatarFallback className="text-xs">{userInitial}</AvatarFallback>
              </Avatar>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="min-h-[calc(100vh-4rem)] md:min-h-screen">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
