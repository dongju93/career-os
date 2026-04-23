# Career OS — Frontend Design Specification

This document is the authoritative reference for the Career OS frontend design system. Any redesign or new feature implementation must conform to every section below. It covers design tokens, glassmorphism utilities, typography, layout architecture, every UI primitive component, and each page.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Required Dependency: `@/lib/utils`](#2-required-dependency-libutils)
3. [CSS Design Tokens](#3-css-design-tokens)
4. [Page Background & Ambient Blobs](#4-page-background--ambient-blobs)
5. [Glassmorphism Utility Classes](#5-glassmorphism-utility-classes)
6. [Button & Input Utility Classes](#6-button--input-utility-classes)
7. [Typography](#7-typography)
8. [Scrollbar Styling](#8-scrollbar-styling)
9. [Animations](#9-animations)
10. [Layout Architecture](#10-layout-architecture)
11. [Navigation](#11-navigation)
12. [UI Component Specifications](#12-ui-component-specifications)
13. [Recurring Visual Patterns](#13-recurring-visual-patterns)
14. [Page Specifications](#14-page-specifications)
15. [Responsive Breakpoints](#15-responsive-breakpoints)
16. [Accessibility & Focus States](#16-accessibility--focus-states)
17. [Mantine Configuration Notes](#17-mantine-configuration-notes)

---

## 1. Design Philosophy

**Glassmorphism + Cyan/Teal palette on a pure-white base.**

Every surface layers translucent frosted-glass panels on a bright, light background. The primary brand color is vivid cyan-teal (`hsl(185 72% 42%)`). Surfaces breathe with `backdrop-filter: blur + saturate`, dark-channel borders (`rgba(0,0,0,0.06)`), and minimal box shadows. Ambient decorative blobs (absolutely positioned, blurred gradient circles) create depth behind glass panels. Motion is restrained — entry animations and hover lifts only.

**Key rules:**

- Glass surfaces use white-channel backgrounds with `backdrop-filter: blur(20px) saturate(120%)` and dark-channel borders (`rgba(0,0,0,0.06)`), not white borders.
- Shadows use near-black with very low alpha. Never use `gray` color names.
- Rounded corners: `rounded-2xl` on cards, `rounded-xl` on interactive elements, `rounded-full` on badges, chips, and avatars.
- Never use Mantine component primitives for new UI — use the custom CVA-based components in `src/components/ui/`.
- All user-facing text is in Korean. Code identifiers are in English.
- Icons from `lucide-react` only.

---

## 2. Required Dependency: `@/lib/utils`

All component and page files import `cn()` from `@/lib/utils`. The file lives at `src/lib/utils.ts`:

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Required packages: `clsx`, `tailwind-merge`.

---

## 3. CSS Design Tokens

All tokens are defined as CSS custom properties in `src/index.css` under `:root`. Tailwind v4 consumes them via `@theme inline` mappings. They are referenced with `hsl(var(--token))`.

### Semantic Color Tokens

| Token                      | HSL Value     | Approximate Color    | Purpose                              |
| -------------------------- | ------------- | -------------------- | ------------------------------------ |
| `--background`             | `0 0% 100%`   | Pure white           | Page background base                 |
| `--foreground`             | `0 0% 9%`     | Near black           | Default body text                    |
| `--card`                   | `210 20% 98%` | Near-white cool tint | Card background (non-glass mode)     |
| `--card-foreground`        | `222 47% 11%` | Very dark blue-gray  | Card text                            |
| `--popover`                | `0 0% 100%`   | Pure white           | Popover background                   |
| `--popover-foreground`     | `222 47% 11%` | Dark text            | Popover text                         |
| `--primary`                | `185 72% 42%` | Vivid cyan-teal      | Brand primary, buttons, icons, links |
| `--primary-foreground`     | `0 0% 100%`   | White                | Text on primary-colored elements     |
| `--secondary`              | `210 20% 96%` | Light cool gray      | Secondary backgrounds                |
| `--secondary-foreground`   | `222 47% 11%` | Dark blue-gray       | Text on secondary elements           |
| `--muted`                  | `210 20% 96%` | Same as secondary    | Subdued / disabled backgrounds       |
| `--muted-foreground`       | `215 16% 35%` | Medium gray          | Placeholder / helper text            |
| `--accent`                 | `185 40% 94%` | Very light teal tint | Hover backgrounds, chip fills        |
| `--accent-foreground`      | `185 72% 32%` | Deeper teal          | Text on accent backgrounds           |
| `--destructive`            | `0 72% 51%`   | Standard red         | Errors, delete actions               |
| `--destructive-foreground` | `0 0% 100%`   | White                | Text on destructive elements         |
| `--border`                 | `214 20% 88%` | Light cool-gray      | Dividers, input borders              |
| `--input`                  | `214 20% 88%` | Same as `--border`   | Input field border                   |
| `--ring`                   | `185 72% 42%` | Same as `--primary`  | Focus ring color                     |
| `--radius`                 | `1rem`        | —                    | Base border radius                   |

### Tailwind v4 Theme

Tailwind v4 has no `tailwind.config.js`. All configuration lives in `src/index.css` via `@theme inline`. The `--font-sans` variable maps to the Inter-first body stack.

---

## 4. Page Background & Ambient Blobs

There is **no fixed CSS background gradient** on `body`. The background is plain `hsl(var(--background))` (pure white).

Depth and atmosphere come from **ambient blobs** rendered as absolutely positioned elements inside each layout component or standalone page:

```html
<!-- Blob pattern (3 blobs in AppLayout / LoginPage) -->
<div aria-hidden class="pointer-events-none absolute ...">
  <!-- top-right: cyan/primary -->
  <div
    class="absolute -right-32 -top-32 h-[28rem] w-[28rem]
              bg-linear-to-br from-cyan-400/40 via-primary/25 to-transparent
              rounded-full blur-3xl"
  />
  <!-- bottom-left: teal -->
  <div
    class="absolute -bottom-24 -left-24 h-96 w-96
              bg-linear-to-tr from-teal-400/35 via-primary/20 to-transparent
              rounded-full blur-3xl"
  />
  <!-- mid-right: purple/pink -->
  <div
    class="absolute right-1/4 top-1/2 h-72 w-72
              bg-linear-to-br from-purple-500/30 to-pink-500/20
              rounded-full blur-3xl"
  />
</div>
```

All blobs are `pointer-events-none` and `aria-hidden`. They are always placed behind content with a low `z-index`. LoginPage and AuthCallbackPage use 2 blobs; AppLayout uses 3.

---

## 5. Glassmorphism Utility Classes

Five global utility classes are defined in `src/index.css`. Always use these class names — never replicate with inline styles.

### `.glass`

Primary glass for cards and floating panels.

```css
.glass {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.85),
    rgba(255, 255, 255, 0.6)
  );
  backdrop-filter: blur(20px) saturate(120%);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow:
    0 2px 16px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}
```

### `.glass-strong`

Heavier glass for sidebars and sticky headers.

```css
.glass-strong {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.95),
    rgba(255, 255, 255, 0.75)
  );
  backdrop-filter: blur(24px) saturate(120%);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
}
```

### `.glass-light`

Lightest glass. Used for chips, badges, and small elements layered on top of `.glass` surfaces.

```css
.glass-light {
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(12px) saturate(120%);
  border: 1px solid rgba(0, 0, 0, 0.04);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
}
```

### `.glass-hover`

Transition helper attached alongside `.glass` on interactive cards. Handles the hover lift animation without duplicating transition logic.

```css
.glass-hover {
  transition:
    transform 250ms ease,
    box-shadow 300ms ease,
    background 250ms ease;
}
.glass-hover:hover {
  background: rgba(255, 255, 255, 0.8);
  border-color: rgba(0, 0, 0, 0.1);
  box-shadow:
    0 6px 24px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
  transform: translateY(-2px);
}
```

### `.surface`

Solid (non-frosted) surface. Used when `Card` is rendered with `glass={false}`.

```css
.surface {
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
```

---

## 6. Button & Input Utility Classes

These CSS utility classes are defined in `src/index.css` and consumed by the `Button` and `Input`/`Textarea` components via CVA variants.

### `.btn-primary`

```css
.btn-primary {
  background: linear-gradient(135deg, hsl(185 72% 40%), hsl(185 68% 34%));
  color: #fff;
  font-weight: 700;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(6, 182, 212, 0.2);
}
.btn-primary:hover {
  background: linear-gradient(135deg, hsl(185 72% 44%), hsl(185 68% 38%));
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.08),
    0 4px 12px rgba(6, 182, 212, 0.3);
}
```

### `.btn-secondary`

```css
.btn-secondary {
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
.btn-secondary:hover {
  background: rgba(0, 0, 0, 0.07);
  border-color: rgba(0, 0, 0, 0.16);
}
```

### `.btn-ghost`

```css
.btn-ghost {
  background: transparent;
  color: hsl(var(--muted-foreground));
  border: 1px solid transparent;
}
.btn-ghost:hover {
  background: rgba(0, 0, 0, 0.04);
  color: hsl(var(--foreground));
}
```

### `.input-clean`

Applied to `Input` and `Textarea`.

```css
.input-clean {
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
}
.input-clean:hover {
  border-color: rgba(0, 0, 0, 0.16);
}
.input-clean:focus {
  background: rgba(0, 0, 0, 0.04);
  border-color: hsl(var(--primary) / 0.5);
  box-shadow:
    0 0 0 3px hsl(var(--primary) / 0.1),
    inset 0 1px 2px rgba(0, 0, 0, 0.04);
}
```

---

## 7. Typography

### Font Stacks

**Body / UI text** (`--font-sans`, applied via Tailwind's `font-sans`):

```
"Inter", "IBM Plex Sans", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif
```

**Headings** (Mantine theme config — not actively rendered, but declared):

```
"Space Grotesk", "IBM Plex Sans", "Avenir Next", "Segoe UI Variable", sans-serif
font-weight: 700
```

### Heading Base Styles

All `h1`–`h6` receive:

```css
h1,
h2,
h3,
h4,
h5,
h6 {
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.25;
}
```

### Tailwind Size Scale in Use

| Tailwind Class                                                   | Role                                  |
| ---------------------------------------------------------------- | ------------------------------------- |
| `text-2xl sm:text-3xl font-bold tracking-tight`                  | Primary page title (H1)               |
| `text-xl font-bold`                                              | Card/section title (`CardTitle`)      |
| `text-lg font-semibold tracking-tight`                           | Auth/callback state headers           |
| `text-sm font-semibold`                                          | Nav item label, form section heading  |
| `text-xs font-semibold tracking-[0.15em] uppercase text-primary` | Page super-label (above H1)           |
| `text-xs uppercase tracking-widest`                              | Sub-labels (e.g., "Not Found" on 404) |
| `text-xs text-muted-foreground`                                  | Helper text, timestamps, meta info    |
| `text-[11px] font-medium tracking-wide uppercase text-gray-600`  | Summary chip labels                   |

---

## 8. Scrollbar Styling

Applied globally via `index.css`:

```css
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}
```

---

## 9. Animations

All keyframes and animation utility classes are defined in `src/index.css`.

### `fade-in` / `.animate-fade-in`

```css
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fade-in {
  animation: fade-in 0.4s ease-out both;
}
```

**Used on:** page-level wrappers for every page (`JobPostingsPage`, `AddJobPostingPage`, `LoginPage`, `AuthCallbackPage`, `NotFoundPage`).

### `slide-in-right` / `.animate-slide-in`

```css
@keyframes slide-in-right {
  from {
    opacity: 0;
    transform: translateX(-12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
.animate-slide-in {
  animation: slide-in-right 0.3s ease-out both;
}
```

**Used on:** elements that enter from the left (name is legacy; direction is left → center).

### Hover Motion

Interactive cards (via `.glass-hover`) use CSS transitions for the lift effect (see §5).

Buttons use:

```
active:scale-[0.97]
```

---

## 10. Layout Architecture

### Router Tree

```
/login                    → LoginPage         (no layout wrapper)
/auth/callback            → AuthCallbackPage  (no layout wrapper)

/ (ProtectedRoute)
  └── AppLayout
       ├── /                  → redirect to /job-postings
       ├── /job-postings      → JobPostingsPage
       ├── /job-postings/new  → AddJobPostingPage
       └── *                  → NotFoundPage
```

`ProtectedRoute` redirects unauthenticated users to `/login?next=<current-path>`.  
`AppLayout` is the single wrapper for all authenticated pages. Source: `src/app/router.tsx`.

### `AppLayout` (`src/components/app-layout.tsx`)

#### Structure

```
<div class="relative min-h-screen overflow-hidden">
  <!-- 3 ambient blobs (aria-hidden, pointer-events-none) -->

  <!-- Desktop sidebar (md+) -->
  <aside class="fixed inset-y-0 left-0 z-50 hidden w-64 rounded-r-3xl border-r border glass-strong md:flex">
    <SidebarContent />
  </aside>

  <!-- Mobile header (< md) -->
  <header class="sticky top-0 z-40 h-14 flex items-center justify-between border-b border px-4 glass-strong md:hidden">
    ...
  </header>

  <!-- Mobile sidebar overlay (when open) -->
  <div class="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden" />
  <aside class="fixed inset-y-0 left-0 z-50 w-64 border-r border glass-strong md:hidden">
    <SidebarContent />
  </aside>

  <!-- Main content -->
  <main class="relative md:pl-64">
    <div class="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <Outlet />
    </div>
  </main>
</div>
```

#### Desktop Sidebar

| Property  | Value                                             |
| --------- | ------------------------------------------------- |
| Position  | `fixed inset-y-0 left-0 z-50`                     |
| Width     | `w-64` (16rem / 256px)                            |
| Shape     | `rounded-r-3xl` (right side only)                 |
| Surface   | `.glass-strong`                                   |
| Padding   | `p-5`                                             |
| Structure | Three sections: logo top, nav middle, user bottom |

**Logo section:**

```html
<div class="mb-8 flex items-center gap-3">
  <div
    class="h-10 w-10 rounded-xl bg-linear-to-br from-primary to-teal-400
              text-sm font-black text-slate-900 shadow-lg shadow-primary/30
              flex items-center justify-center"
  >
    CO
  </div>
  <div>
    <span class="text-lg font-bold tracking-tight">Career OS</span>
    <span class="text-xs text-gray-600 block">채용 관리 시스템</span>
  </div>
</div>
```

**User section (bottom):**

```html
<div class="mt-auto pt-4 flex items-center gap-3 rounded-xl border-white/12 bg-muted p-3">
  <Avatar />
  <div class="flex-1 min-w-0">
    <p class="text-sm font-medium truncate">{displayName}</p>
    <p class="text-xs text-gray-500 truncate">{email}</p>
  </div>
  <Button size="icon" variant="ghost">  <!-- LogOut icon -->
</div>
```

#### Mobile Header (< `md`)

- `sticky top-0 z-40 h-14 flex items-center justify-between px-4 glass-strong border-b border md:hidden`
- Left: hamburger `Button variant="ghost"` toggling `mobileOpen` (`Menu` / `X` icon)
- Center: same logo mark + "Career OS" text
- Right: `Avatar` (h-8 w-8)

#### Mobile Sidebar

When `mobileOpen` is true:

- Backdrop: `fixed inset-0 z-40 bg-black/20 backdrop-blur-sm`
- Sidebar: same `SidebarContent` but **without** `rounded-r-3xl`, full-height flush

---

## 11. Navigation

### Navigation Items

```ts
const navigationItems = [
  {
    href: "/job-postings",
    icon: Briefcase,
    label: "채용공고",
    description: "저장한 채용공고 관리",
  },
  {
    href: "/job-postings/new",
    icon: PlusCircle,
    label: "채용공고 등록",
    description: "새 URL 스크랩 및 저장",
  },
];
```

To add a new authenticated page, add an entry here and a route in `router.tsx`.

### Nav Link Anatomy

Each nav item is a React Router `<NavLink>` rendered with `isActive` from the router. Active state uses exact match only.

```html
<!-- Active state -->
<div
  class="flex items-center gap-3 rounded-xl border border-primary/20
            bg-primary/15 px-3 py-2.5 text-primary"
>
  <!-- Icon container -->
  <div
    class="h-9 w-9 rounded-lg bg-primary text-slate-900 shadow-sm
              flex items-center justify-center flex-shrink-0"
  >
    <Icon class="h-4 w-4" />
  </div>
  <!-- Text -->
  <div class="flex-1 min-w-0">
    <div class="text-sm font-semibold">{label}</div>
    <div class="text-xs text-primary/70">{description}</div>
  </div>
  <!-- Chevron — visible only when active -->
  <ChevronRight class="h-4 w-4 translate-x-0 opacity-100 text-primary" />
</div>

<!-- Inactive state -->
<div
  class="flex items-center gap-3 rounded-xl border border-transparent
            px-3 py-2.5 text-gray-600 hover:bg-muted hover:text-foreground"
>
  <div
    class="h-9 w-9 rounded-lg bg-muted text-gray-600
              group-hover:bg-white/10 group-hover:text-primary
              flex items-center justify-center flex-shrink-0"
  >
    <Icon class="h-4 w-4" />
  </div>
  <div class="flex-1 min-w-0">
    <div class="text-sm font-semibold">{label}</div>
    <div class="text-xs text-muted-foreground">{description}</div>
  </div>
  <ChevronRight class="h-4 w-4 -translate-x-1 opacity-0 transition-all" />
</div>
```

---

## 12. UI Component Specifications

All components live in `src/components/ui/`. They use Radix UI primitives where needed, styled with CVA variants + Tailwind. Import `cn` from `@/lib/utils`.

### `Button` (`button.tsx`)

**Base classes (all variants):**

```
inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm
font-semibold ring-offset-background transition-all duration-200
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]
```

| Variant       | Classes                                                              |
| ------------- | -------------------------------------------------------------------- |
| `default`     | `btn-primary`                                                        |
| `destructive` | `bg-red-500 text-white hover:bg-red-400 shadow-sm shadow-red-500/25` |
| `outline`     | `btn-secondary`                                                      |
| `secondary`   | `glass-light text-foreground hover:bg-white/15`                      |
| `ghost`       | `btn-ghost`                                                          |
| `link`        | `text-primary underline-offset-4 hover:underline`                    |
| `glass`       | `glass text-foreground hover:bg-white/15`                            |

| Size      | Classes                          |
| --------- | -------------------------------- |
| `default` | `h-10 px-5 py-2`                 |
| `sm`      | `h-9 rounded-lg px-3 text-xs`    |
| `lg`      | `h-11 rounded-xl px-8 text-base` |
| `icon`    | `h-10 w-10`                      |

**Props:** standard button attributes + `variant`, `size`, `loading?: boolean`, `asChild?: boolean`.  
**`loading` prop:** renders an inline SVG spinner (`animate-spin`) and sets `disabled`.

### `Card` (`card.tsx`)

| Prop          | Default | Effect                                          |
| ------------- | ------- | ----------------------------------------------- |
| `glass`       | `true`  | Applies `.glass`; `false` applies `.surface`    |
| `interactive` | `false` | Adds `.glass-hover cursor-pointer` (hover lift) |

```
glass=true:               "glass rounded-2xl"
glass=true, interactive:  "glass glass-hover rounded-2xl cursor-pointer"
glass=false:              "surface rounded-2xl"
```

Sub-components:

| Component         | Classes                                                  |
| ----------------- | -------------------------------------------------------- |
| `CardHeader`      | `flex flex-col space-y-1.5 p-6`                          |
| `CardTitle`       | `<h3>` — `text-xl font-bold leading-none tracking-tight` |
| `CardDescription` | `<p>` — `text-sm text-muted-foreground`                  |
| `CardContent`     | `p-6 pt-0`                                               |
| `CardFooter`      | `flex items-center p-6 pt-0`                             |

### `Badge` (`badge.tsx`)

**Base:** `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors`

| Variant       | Classes                                                 |
| ------------- | ------------------------------------------------------- |
| `default`     | `glass-light text-primary border`                       |
| `secondary`   | `glass-light text-gray-600 border`                      |
| `destructive` | `bg-red-500/15 text-red-300 border-red-400/25`          |
| `outline`     | `glass-light text-foreground border-white/15`           |
| `saramin`     | `bg-orange-400/15 text-orange-300 border-orange-400/25` |
| `wanted`      | `bg-teal-400/15 text-teal-300 border-teal-400/25`       |
| `glass`       | `glass-light text-foreground`                           |

Platform badges (`saramin`, `wanted`) are used exclusively for the job posting platform label.

### `Input` (`input.tsx`)

```
input-clean h-10 w-full rounded-xl px-4 py-2 text-sm
placeholder:text-muted-foreground focus-visible:outline-none
disabled:cursor-not-allowed disabled:opacity-50 transition-all
```

**Error state** (via `error` prop): `border-red-400/60 focus-visible:ring-red-400/20`

### `Textarea` (`textarea.tsx`)

Same as `Input` with:

```
min-h-24 py-3 resize-none
```

### `Label` (`label.tsx`)

```
text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70
```

### `Alert` (`alert.tsx`)

**Base:** `relative w-full rounded-xl border p-4 [&>svg~*]:pl-7 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4`

| Variant       | Classes                                                    |
| ------------- | ---------------------------------------------------------- |
| `default`     | `glass-light border-white/10 text-foreground`              |
| `destructive` | `bg-red-500/10 border-red-400/20 text-red-300`             |
| `success`     | `bg-emerald-500/10 border-emerald-400/20 text-emerald-300` |
| `warning`     | `bg-amber-500/10 border-amber-400/20 text-amber-300`       |

`AlertTitle`: `<h5>` — `mb-1 font-semibold leading-none tracking-tight`  
`AlertDescription`: `<p>` — `text-sm [&_p]:leading-relaxed`

### `Avatar` (`avatar.tsx`)

Built on `@radix-ui/react-avatar`.

`AvatarRoot`: `relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-gray-300 bg-gray-200`  
`AvatarImage`: `aspect-square h-full w-full object-cover`  
`AvatarFallback`: `flex h-full w-full items-center justify-center rounded-full bg-linear-to-br from-primary/30 to-primary/15 text-primary font-semibold text-sm`

Fallback renders the first letter(s) of the user's display name.

### `Separator` (`separator.tsx`)

`bg-border/60` + orientation:

- Horizontal: `h-px w-full`
- Vertical: `h-full w-px`

### `Skeleton` (`skeleton.tsx`)

```
animate-pulse rounded-lg
bg-linear-to-r from-white/8 via-white/15 to-white/8
bg-size-[200%_100%]
```

### `TagInput` (`tag-input.tsx`)

A controlled multi-tag input. Tags are displayed inline as `<Badge variant="glass">` chips with a remove button.

**Wrapper div:** `input-clean flex min-h-10 w-full flex-wrap gap-1.5 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 transition-all`

**Inner input:** `flex-1 min-w-32 bg-transparent text-sm outline-none placeholder:text-muted-foreground`

**Behavior:**

- `Enter` or `,` adds the current value as a tag
- `Backspace` on empty input removes the last tag
- Blur with pending content adds the tag

**Props:** `value: string[]`, `onChange: (tags: string[]) => void`, `placeholder?: string`, `className?: string`, `id?: string`

---

## 13. Recurring Visual Patterns

### Brand Gradient (Logo Mark)

```
bg-linear-to-br from-primary to-teal-400
```

Text: `font-black text-slate-900` — "CO"

Used on: sidebar logo mark, mobile header logo mark, login page logo mark. Shape: `rounded-xl` in sidebar/mobile, `rounded-2xl` on login page.

### Ambient Blobs

See §4. Always 2–3 per page, always `pointer-events-none aria-hidden`, always `rounded-full blur-3xl`.

### Page Header Pattern

The page header floats directly on the background — no Card wrapper:

```html
<div>
  <p class="text-xs font-semibold tracking-[0.15em] text-primary uppercase">
    {superLabel}
  </p>
  <h1 class="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
  <p class="text-muted-foreground">{description}</p>
</div>
```

Used on: `JobPostingsPage`.

### Summary Chips

Small stat chips in the page header area:

```html
<div
  class="min-w-28 rounded-xl border-white/12 bg-accent px-4 py-2.5 backdrop-blur-md"
>
  <p class="text-[11px] font-medium tracking-wide text-gray-600 uppercase">
    {label}
  </p>
  <p class="text-lg font-semibold tracking-tight text-foreground">{value}</p>
</div>
```

### Icon in Gradient Container

```html
<div
  class="h-16 w-16 rounded-2xl bg-linear-to-br from-primary/20 to-teal-500/10
            flex items-center justify-center"
>
  <Icon class="h-8 w-8 text-primary" />
</div>
```

Used on: empty state (`Sparkles` icon). `NotFoundPage` uses `bg-accent text-gray-600 border` instead.

### Form Section Heading

```html
<div
  class="inline-flex items-center gap-2 rounded-full bg-accent border px-3 py-1.5"
>
  <Icon class="h-4 w-4 text-primary" />
  <span class="text-sm font-semibold">{sectionTitle}</span>
</div>
```

### Details Panel (inside JobPostingCard)

```html
<div class="rounded-xl border border-white/8 bg-muted p-3">
  <!-- structured key-value pairs for deadline, location, salary, etc. -->
</div>
```

### Status Chips (inside JobPostingCard)

```
deadline:  rounded-full bg-red-500/8 px-2.5 py-0.5 text-xs font-medium text-red-600 border border-red-500/15
salary:    rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-gray-600 border
```

### Spinner with Glow (Auth Callback)

```html
<div
  class="relative h-[4.5rem] w-[4.5rem] rounded-full bg-primary/10 border border-primary/20"
>
  <div class="absolute inset-0 rounded-full bg-primary/10 blur-md" />
  <Loader2
    class="absolute inset-0 m-auto h-10 w-10 text-primary animate-spin"
  />
</div>
```

---

## 14. Page Specifications

### `JobPostingsPage` (`src/pages/job-postings-page.tsx`)

- Root: `animate-fade-in space-y-6`
- **Header**: transparent, floating. Super-label + H1 + summary chips row + CTA `<Button asChild>` wrapping `<Link to="/job-postings/new">`
- **Grid**: `grid gap-5 sm:grid-cols-2 lg:grid-cols-3` (same for loading skeletons and cards)
- **Loading state**: `<LoadingCard />` × N — `<Card>` with stacked `<Skeleton>` placeholders
- **Error state**: `min-h-[22rem] rounded-xl border border-red-500/20 bg-red-500/8 px-6 py-12 text-center` — icon circle + message + retry `<Button>`
- **Empty state**: full-span `<Card>` centered in grid — gradient icon container with `Sparkles` + CTA
- **`JobPostingCard`**: `<Card interactive>`, `<CardContent className="relative p-5">`, platform `<Badge>`, company with `Building2` icon, `<h3>` title with `line-clamp-2 group-hover:text-primary`, details panel, deadline/salary chips, tech stack `<Badge variant="secondary">` (max 5) + overflow `<Badge variant="outline">`

### `AddJobPostingPage` (`src/pages/add-job-posting-page.tsx`)

Three phases driven by local state:

**Phase 1 — URL Input:**

- `<Card>` with `<CardHeader>` (border-b border-white/8), `<CardContent>`
- Input row: `flex flex-col gap-3 rounded-xl border border-white/8 bg-muted p-3 sm:flex-row`
- `<Input>` + `<Button loading={isExtracting}>`
- On error: `<Alert variant="destructive">`

**Phase 2 — Editable Extracted Form:**

- Card header: `border-b border-white/8 bg-white/3` — platform `<Badge>` + `<CardTitle>` + `<CardDescription>` + external link icon
- `<FormSection>` component: renders a section heading pill (see §13)
- `<FormField>` component: `space-y-1.5` wrapper with `<Label htmlFor>` + input + optional `text-xs text-red-400` error
- Section layout grids: `grid-cols-1`, `sm:grid-cols-2`, `sm:grid-cols-2 lg:grid-cols-3`
- Tag fields (tech_stack, tags): `<TagInput>`
- `<CardFooter>`: Cancel `<Button variant="outline">` + Save `<Button loading={isSaving}>`

**Phase 3 — Success:**

- `animate-fade-in` centered `<Card className="py-12 text-center">`
- Success icon: `rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20`
- Two CTAs: `<Button variant="outline">` (back to list) + `<Button>` (register another)

### `LoginPage` (`src/pages/login-page.tsx`)

- Root: `relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-10`
- 3 ambient blobs
- `<Card className="mx-4 w-full max-w-md animate-fade-in">`
- `<CardContent className="px-8 pb-8 pt-8">` — content centered
- Label badge: `rounded-full bg-primary/15 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-primary uppercase border border-primary/20` — "Frosted Workspace"
- Logo: `h-14 w-14 rounded-2xl` brand gradient mark
- `<h1 class="text-3xl font-bold tracking-tight">`
- Error: `<Alert variant="destructive">`
- CTA: `<Button className="w-full justify-center" variant="glass" loading={isLoading}>` with inline Google SVG icon
- Disclaimer: `text-xs text-gray-500 text-center text-balance`

### `AuthCallbackPage` (`src/pages/auth-callback-page.tsx`)

- Root: `relative flex min-h-screen items-center justify-center overflow-hidden px-4`
- 2 ambient blobs
- `<Card className="w-full max-w-sm animate-fade-in">`
- `<CardContent className="flex flex-col items-center gap-5 px-8 py-10 text-center">`
- Spinner glow pattern (see §13)
- `<p class="text-lg font-semibold tracking-tight">` + `<p class="text-sm text-gray-600">`

### `NotFoundPage` (`src/pages/not-found-page.tsx`)

- Root: `flex min-h-[60vh] items-center justify-center animate-fade-in`
- `<Card className="mx-auto w-full max-w-md text-center">`
- Icon: `h-16 w-16 rounded-2xl bg-accent text-gray-600 border` with `<FileQuestion>`
- Label: `text-xs tracking-widest text-gray-500 uppercase` — "Not Found"
- `<h1 class="text-2xl font-bold tracking-tight">`
- CTA: `<Button asChild>` + `<Link>` with `<ArrowLeft>` icon

---

## 15. Responsive Breakpoints

Tailwind defaults only. No custom breakpoints.

| Breakpoint | Min Width | Key Layout Change                                                               |
| ---------- | --------- | ------------------------------------------------------------------------------- |
| (default)  | 0px       | Single-column card grid; stacked page header; mobile AppLayout (sticky top bar) |
| `sm`       | 640px     | 2-column card grid; page header row; form grids 2-col; URL input row            |
| `md`       | 768px     | Static sidebar visible (`pl-64`); mobile header hidden                          |
| `lg`       | 1024px    | 3-column card grid; form grid 3-col                                             |

---

## 16. Accessibility & Focus States

**Global focus ring:**

```css
:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
```

`--ring` is `185 72% 42%` (same as `--primary`) — teal focus rings everywhere.

**Text selection:**

```css
::selection {
  background: rgba(6, 182, 212, 0.18);
}
```

**Disabled state:** `disabled:pointer-events-none disabled:opacity-50` on all interactive components.

**Screen reader support:** Use `sr-only` for icon-only buttons (logout, hamburger). Radix UI primitives provide ARIA roles automatically.

---

## 17. Mantine Configuration Notes

`MantineProvider` wraps the app root for theme consistency, but **no Mantine component primitives are used anywhere in the UI**. The Mantine theme in `src/app/theme.ts`:

```ts
{
  primaryColor: 'orange',   // not rendered; does not match CSS --primary
  defaultRadius: 'md',
  fontFamily: 'IBM Plex Sans, Avenir Next, Segoe UI Variable, Segoe UI, sans-serif',
  headings: {
    fontFamily: 'Space Grotesk, IBM Plex Sans, Avenir Next, Segoe UI Variable, sans-serif',
    fontWeight: '700',
  },
}
```

**Rule:** Do not add new Mantine component usages. All new UI must use the `src/components/ui/` primitives described in §12.

---

## Quick Checklist for New Pages

When adding a new authenticated page:

- [ ] Add a `navigationItems` entry in `src/components/app-layout.tsx` (§11)
- [ ] Add a route inside `ProtectedRoute → AppLayout` in `src/app/router.tsx` (§10)
- [ ] Wrap the page root element with `animate-fade-in`
- [ ] Use `max-w-6xl mx-auto` (handled by `AppLayout`) — do not add extra centering wrappers
- [ ] Use `<Card>` (default `glass={true}`) for content panels
- [ ] Use `<Button>` variants from §12 — never raw `<button>`
- [ ] Korean UI labels throughout
- [ ] Icons from `lucide-react` only
- [ ] Import `cn` from `@/lib/utils` if conditional class merging is needed
- [ ] Page header: floating (no Card), transparent, with super-label above `<h1>`
