import * as stylex from '@stylexjs/stylex';
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
import { surfaces } from '@/styles/surfaces';
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
    <div {...stylex.props(styles.sidebarContentRow)}>
      {/* Logo */}
      <div {...stylex.props(styles.sidebarContentRow2)}>
        <div {...stylex.props(styles.sidebarContentRow3)}>CO</div>
        <div>
          <span {...stylex.props(styles.sidebarContentText)}>Career OS</span>
          <span {...stylex.props(styles.sidebarContentText2)}>
            채용 관리 시스템
          </span>
        </div>
        {/* The drawer is a modal <dialog>, so the background header toggle is
            inert while it is open — the close affordance must live inside. */}
        {onClose && (
          <button
            aria-label="메뉴 닫기"
            {...stylex.props(styles.sidebarContentButton)}
            type="button"
            onClick={onClose}
          >
            <X {...stylex.props(styles.sidebarContentX)} />
          </button>
        )}
      </div>

      <nav {...stylex.props(styles.sidebarContentNav)}>
        {navigationItems.map(({ href, icon: Icon, label, description }) => (
          <NavLink
            key={href}
            end
            className={({ isActive }) =>
              stylex.props([
                styles.sidebarContentNavLink,
                stylex.defaultMarker(),
                isActive
                  ? styles.sidebarContentNavLink2
                  : styles.sidebarContentNavLink3,
              ]).className
            }
            to={href}
            onClick={onClose}
          >
            {({ isActive }) => (
              <>
                <div
                  {...stylex.props([
                    styles.sidebarContentRow4,
                    isActive
                      ? styles.sidebarContentContainer
                      : styles.sidebarContentContainer2,
                  ])}
                >
                  <Icon {...stylex.props(styles.sidebarContentIcon)} />
                </div>
                <div {...stylex.props(styles.sidebarContentContainer3)}>
                  <div {...stylex.props(styles.sidebarContentContainer4)}>
                    {label}
                  </div>
                  <div
                    {...stylex.props([
                      styles.sidebarContentContainer5,
                      isActive
                        ? styles.sidebarContentContainer6
                        : styles.sidebarContentContainer7,
                    ])}
                  >
                    {description}
                  </div>
                </div>
                <ChevronRight
                  {...stylex.props([
                    styles.sidebarContentChevronRight,
                    isActive
                      ? styles.sidebarContentChevronRight2
                      : styles.sidebarContentChevronRight3,
                  ])}
                />
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div {...stylex.props(styles.sidebarContentContainer8)}>
        {user && (
          <div {...stylex.props(styles.sidebarContentRow5)}>
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
            <div {...stylex.props(styles.sidebarContentContainer3)}>
              <div {...stylex.props(styles.sidebarContentContainer9)}>
                {user.name ?? user.email}
              </div>
              {user.name && (
                <div {...stylex.props(styles.sidebarContentContainer10)}>
                  {user.email}
                </div>
              )}
            </div>
            <Button
              xstyle={styles.sidebarContentButton2}
              size="icon"
              variant="ghost"
              onClick={handleLogout}
            >
              <LogOut {...stylex.props(styles.sidebarContentIcon)} />
              <span {...stylex.props(styles.sidebarContentText3)}>
                로그아웃
              </span>
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
    <div {...stylex.props(styles.appLayoutContainer)}>
      {/* Skip link — first focusable element; jumps keyboard/AT users past the
          sidebar nav straight to page content. Hidden until focused. */}
      <a {...stylex.props(styles.appLayoutLink)} href="#main-content">
        본문으로 건너뛰기
      </a>

      {/* Ambient background blobs — visible through glass */}
      <div aria-hidden="true" {...stylex.props(styles.appLayoutContainer2)} />
      <div aria-hidden="true" {...stylex.props(styles.appLayoutContainer3)} />
      <div aria-hidden="true" {...stylex.props(styles.appLayoutContainer4)} />

      {/* Sidebar — glass-strong, background blur clearly visible */}
      <aside {...stylex.props([styles.appLayoutAside, surfaces.glassStrong])}>
        <SidebarContent />
      </aside>

      {/* Mobile header — glass-strong */}
      <header {...stylex.props([styles.appLayoutHeader, surfaces.glassStrong])}>
        <Button
          aria-controls={drawerId}
          aria-expanded={mobileOpen}
          aria-haspopup="dialog"
          size="icon"
          variant="ghost"
          onClick={() => setMobileOpen(true)}
        >
          <Menu {...stylex.props(styles.sidebarContentX)} />
          <span {...stylex.props(styles.sidebarContentText3)}>메뉴 열기</span>
        </Button>

        <div {...stylex.props(styles.appLayoutRow)}>
          <div {...stylex.props(styles.appLayoutRow2)}>CO</div>
          <span {...stylex.props(styles.appLayoutText)}>Career OS</span>
        </div>

        <AvatarRoot xstyle={styles.appLayoutAvatarRoot}>
          {user?.picture && (
            <AvatarImage
              alt={user.name ?? ''}
              referrerPolicy="no-referrer"
              src={user.picture}
            />
          )}
          <AvatarFallback xstyle={styles.sidebarContentContainer5}>
            {userInitial}
          </AvatarFallback>
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
        {...stylex.props([styles.appLayoutDialog, surfaces.glassStrong])}
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
        {...stylex.props(styles.appLayoutMain)}
        id="main-content"
        tabIndex={-1}
      >
        <div {...stylex.props(styles.appLayoutContainer5)}>
          <Suspense
            fallback={
              <div {...stylex.props(styles.appLayoutRow3)}>로딩 중…</div>
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

const styles = stylex.create({
  sidebarContentRow: {
    display: 'flex',
    height: '100%',
    flexDirection: 'column',
    paddingTop: '1.25rem',
    paddingRight: '1.25rem',
    paddingBottom: '1.25rem',
    paddingLeft: '1.25rem',
  },
  sidebarContentRow2: {
    marginBottom: '2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  sidebarContentRow3: {
    display: 'flex',
    height: '2.5rem',
    width: '2.5rem',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '.75rem',
    backgroundImage:
      'linear-gradient(to bottom right in oklab, hsl(var(--primary)), oklch(77.7% .152 181.912))',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    fontWeight: 900,
    color: 'oklch(20.8% .042 265.755)',
    boxShadow:
      '0 10px 15px -3px color-mix(in oklab, hsl(var(--primary)) 30%, transparent), 0 4px 6px -4px color-mix(in oklab, hsl(var(--primary)) 30%, transparent)',
  },
  sidebarContentText: {
    display: 'block',
    fontSize: '1.125rem',
    lineHeight: '1.75rem',
    fontWeight: 700,
    letterSpacing: '-.025em',
  },
  sidebarContentText2: {
    display: 'block',
    fontSize: '.75rem',
    lineHeight: '1rem',
    color: 'oklch(44.6% .03 256.802)',
  },
  sidebarContentButton: {
    marginLeft: 'auto',
    display: 'inline-flex',
    height: '2.25rem',
    width: '2.25rem',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '.5rem',
    color: {
      default: 'oklch(44.6% .03 256.802)',
      ':hover': 'hsl(var(--foreground))',
    },
    transitionProperty:
      'color, background-color, border-color, outline-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
    backgroundColor: {
      default: null,
      ':hover': 'hsl(var(--muted))',
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
  sidebarContentX: {
    height: '1.25rem',
    width: '1.25rem',
  },
  sidebarContentNav: {
    display: 'flex',
    flex: '1',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  sidebarContentNavLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    borderRadius: '.75rem',
    paddingLeft: '0.75rem',
    paddingRight: '0.75rem',
    paddingTop: '0.625rem',
    paddingBottom: '0.625rem',
    textDecorationLine: 'none',
    transitionProperty: 'all',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '200ms',
  },
  sidebarContentNavLink2: {
    backgroundColor:
      'color-mix(in oklab, hsl(var(--primary)) 15%, transparent)',
    color: 'hsl(var(--primary))',
    borderWidth: '1px',
    borderColor: 'color-mix(in oklab, hsl(var(--primary)) 20%, transparent)',
  },
  sidebarContentNavLink3: {
    color: {
      default: 'oklch(44.6% .03 256.802)',
      ':hover': 'hsl(var(--foreground))',
    },
    backgroundColor: {
      default: null,
      ':hover': 'hsl(var(--muted))',
    },
    borderWidth: '1px',
    borderColor: 'transparent',
  },
  sidebarContentRow4: {
    display: 'flex',
    height: '2.25rem',
    width: '2.25rem',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '.5rem',
    transitionProperty:
      'color, background-color, border-color, outline-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  sidebarContentContainer: {
    backgroundColor: 'hsl(var(--primary))',
    color: 'oklch(20.8% .042 265.755)',
    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  },
  sidebarContentContainer2: {
    backgroundColor: {
      default: 'hsl(var(--muted))',
      [stylex.when.ancestor(':hover')]:
        'color-mix(in oklab, #fff 10%, transparent)',
    },
    color: {
      default: 'oklch(44.6% .03 256.802)',
      [stylex.when.ancestor(':hover')]: 'hsl(var(--primary))',
    },
  },
  sidebarContentIcon: {
    height: '1rem',
    width: '1rem',
  },
  sidebarContentContainer3: {
    flex: '1',
    minWidth: '0rem',
  },
  sidebarContentContainer4: {
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    fontWeight: 600,
  },
  sidebarContentContainer5: {
    fontSize: '.75rem',
    lineHeight: '1rem',
  },
  sidebarContentContainer6: {
    color: 'color-mix(in oklab, hsl(var(--primary)) 70%, transparent)',
  },
  sidebarContentContainer7: {
    color: 'oklch(55.1% .027 264.364)',
  },
  sidebarContentChevronRight: {
    height: '1rem',
    width: '1rem',
    transitionProperty: 'all',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
  sidebarContentChevronRight2: {
    translate: '0rem 0',
    opacity: 1,
    color: 'hsl(var(--primary))',
  },
  sidebarContentChevronRight3: {
    translate: '-0.25rem 0',
    opacity: 0,
  },
  sidebarContentContainer8: {
    marginTop: 'auto',
    paddingTop: '1rem',
  },
  sidebarContentRow5: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    borderRadius: '.75rem',
    borderColor: 'color-mix(in oklab, #fff 12%, transparent)',
    backgroundColor: 'hsl(var(--muted))',
    paddingTop: '0.75rem',
    paddingRight: '0.75rem',
    paddingBottom: '0.75rem',
    paddingLeft: '0.75rem',
  },
  sidebarContentContainer9: {
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sidebarContentContainer10: {
    fontSize: '.75rem',
    lineHeight: '1rem',
    color: 'oklch(55.1% .027 264.364)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sidebarContentButton2: {
    flexShrink: 0,
  },
  sidebarContentText3: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: 0,
  },
  appLayoutContainer: {
    position: 'relative',
    minHeight: '100vh',
    overflow: 'hidden',
  },
  appLayoutLink: {
    position: {
      default: 'absolute',
      ':focus': 'fixed',
    },
    width: {
      default: '1px',
      ':focus': 'auto',
    },
    height: {
      default: '1px',
      ':focus': 'auto',
    },
    padding: {
      default: 0,
      ':focus': 0,
    },
    margin: {
      default: '-1px',
      ':focus': 0,
    },
    overflow: {
      default: 'hidden',
      ':focus': 'visible',
    },
    clip: {
      default: 'rect(0, 0, 0, 0)',
      ':focus': 'auto',
    },
    whiteSpace: {
      default: 'nowrap',
      ':focus': 'normal',
    },
    borderWidth: 0,
    left: {
      default: null,
      ':focus': '1rem',
    },
    top: {
      default: null,
      ':focus': '1rem',
    },
    zIndex: {
      default: null,
      ':focus': 100,
    },
    borderRadius: {
      default: null,
      ':focus': '.5rem',
    },
    backgroundColor: {
      default: null,
      ':focus': 'hsl(var(--primary))',
    },
    paddingLeft: {
      default: null,
      ':focus': '1rem',
    },
    paddingRight: {
      default: null,
      ':focus': '1rem',
    },
    paddingTop: {
      default: null,
      ':focus': '0.5rem',
    },
    paddingBottom: {
      default: null,
      ':focus': '0.5rem',
    },
    fontSize: {
      default: null,
      ':focus': '.875rem',
    },
    lineHeight: {
      default: null,
      ':focus': '1.25rem',
    },
    fontWeight: {
      default: null,
      ':focus': 600,
    },
    color: {
      default: null,
      ':focus': 'oklch(20.8% .042 265.755)',
    },
    boxShadow: {
      default: null,
      ':focus':
        '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    },
  },
  appLayoutContainer2: {
    pointerEvents: 'none',
    position: 'absolute',
    top: '-8rem',
    right: '-8rem',
    height: '28rem',
    width: '28rem',
    borderRadius: '9999px',
    backgroundImage:
      'linear-gradient(to bottom right in oklab, color-mix(in oklab, oklch(78.9% .154 211.53) 40%, transparent), color-mix(in oklab, hsl(var(--primary)) 25%, transparent), transparent)',
    filter: 'blur(64px)',
  },
  appLayoutContainer3: {
    pointerEvents: 'none',
    position: 'absolute',
    bottom: '0rem',
    left: '-6rem',
    height: '24rem',
    width: '24rem',
    borderRadius: '9999px',
    backgroundImage:
      'linear-gradient(to top right in oklab, color-mix(in oklab, oklch(77.7% .152 181.912) 35%, transparent), color-mix(in oklab, hsl(var(--primary)) 20%, transparent), transparent)',
    filter: 'blur(64px)',
  },
  appLayoutContainer4: {
    pointerEvents: 'none',
    position: 'absolute',
    top: '30%',
    right: '10%',
    height: '18rem',
    width: '18rem',
    borderRadius: '9999px',
    backgroundImage:
      'linear-gradient(to bottom right in oklab, color-mix(in oklab, oklch(62.7% .265 303.9) 30%, transparent), color-mix(in oklab, oklch(65.6% .241 354.308) 20%, transparent))',
    filter: 'blur(64px)',
  },
  appLayoutAside: {
    position: 'fixed',
    top: '0rem',
    bottom: '0rem',
    left: '0rem',
    zIndex: 50,
    display: {
      default: 'none',
      '@media (min-width: 48rem)': 'flex',
    },
    width: '16rem',
    flexDirection: 'column',
    borderTopRightRadius: '1.5rem',
    borderBottomRightRadius: '1.5rem',
    borderRightWidth: '1px',
    borderWidth: '1px',
  },
  appLayoutHeader: {
    position: 'sticky',
    top: '0rem',
    zIndex: 40,
    display: {
      default: 'flex',
      '@media (min-width: 48rem)': 'none',
    },
    height: '3.5rem',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: '1px',
    borderWidth: '1px',
    paddingLeft: '1rem',
    paddingRight: '1rem',
  },
  appLayoutRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  appLayoutRow2: {
    display: 'flex',
    height: '2rem',
    width: '2rem',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '.5rem',
    backgroundImage:
      'linear-gradient(to bottom right in oklab, hsl(var(--primary)), oklch(77.7% .152 181.912))',
    fontSize: '.75rem',
    lineHeight: '1rem',
    fontWeight: 900,
    color: 'oklch(20.8% .042 265.755)',
    boxShadow:
      '0 4px 6px -1px color-mix(in oklab, hsl(var(--primary)) 30%, transparent), 0 2px 4px -2px color-mix(in oklab, hsl(var(--primary)) 30%, transparent)',
  },
  appLayoutText: {
    fontSize: '1rem',
    lineHeight: '1.5rem',
    fontWeight: 700,
    letterSpacing: '-.025em',
  },
  appLayoutAvatarRoot: {
    height: '2rem',
    width: '2rem',
  },
  appLayoutDialog: {
    position: 'fixed',
    top: '0rem',
    bottom: '0rem',
    left: '0rem',
    right: 'auto',
    marginTop: '0rem',
    marginRight: '0rem',
    marginBottom: '0rem',
    marginLeft: '0rem',
    height: '100dvh',
    maxHeight: 'none',
    width: '16rem',
    maxWidth: '80vw',
    borderTopRightRadius: '1.5rem',
    borderBottomRightRadius: '1.5rem',
    borderRightWidth: '1px',
    borderWidth: '1px',
    paddingTop: '0rem',
    paddingRight: '0rem',
    paddingBottom: '0rem',
    paddingLeft: '0rem',
    '::backdrop': {
      backgroundColor: 'color-mix(in oklab, #000 20%, transparent)',
      backdropFilter: 'blur(8px)',
    },
    display: {
      default: null,
      '@media (min-width: 48rem)': 'none',
    },
  },
  appLayoutMain: {
    position: 'relative',
    paddingLeft: {
      default: null,
      '@media (min-width: 48rem)': '16rem',
    },
    outlineStyle: 'none',
  },
  appLayoutContainer5: {
    marginLeft: 'auto',
    marginRight: 'auto',
    maxWidth: '72rem',
    paddingLeft: {
      default: '1rem',
      '@media (min-width: 48rem)': '2rem',
    },
    paddingRight: {
      default: '1rem',
      '@media (min-width: 48rem)': '2rem',
    },
    paddingTop: {
      default: '1.5rem',
      '@media (min-width: 48rem)': '2.5rem',
    },
    paddingBottom: {
      default: '1.5rem',
      '@media (min-width: 48rem)': '2.5rem',
    },
  },
  appLayoutRow3: {
    display: 'flex',
    height: '16rem',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '.875rem',
    lineHeight: '1.25rem',
    color: 'oklch(55.1% .027 264.364)',
  },
});
