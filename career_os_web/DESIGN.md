# Career OS — Frontend Design Specification

This document is the authoritative reference for the Career OS frontend design system. Any redesign or new feature implementation must conform to every section below. It covers design tokens, glassmorphism utilities, typography, layout architecture, every UI primitive component, and each page.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Required Dependency: `@/lib/utils`](#2-required-dependency-libutils)
3. [CSS Design Tokens](#3-css-design-tokens)
4. [Page Background](#4-page-background)
5. [Glassmorphism Utility Classes](#5-glassmorphism-utility-classes)
6. [Typography](#6-typography)
7. [Scrollbar Styling](#7-scrollbar-styling)
8. [Animations](#8-animations)
9. [Layout Architecture](#9-layout-architecture)
10. [Navigation](#10-navigation)
11. [UI Component Specifications](#11-ui-component-specifications)
12. [Recurring Visual Patterns](#12-recurring-visual-patterns)
13. [Responsive Breakpoints](#13-responsive-breakpoints)
14. [Accessibility & Focus States](#14-accessibility--focus-states)
15. [Mantine Configuration Notes](#15-mantine-configuration-notes)

---

## 1. Design Philosophy

**Glassmorphism + Cool Cyan/Teal palette.**

Every surface in the app uses translucent frosted-glass panels layered on top of a softly-lit neutral background. The primary brand color is a vivid cyan-teal (`hsl(185 65% 45%)`). Surfaces breathe with subtle backdrop-filter blur, white-channel borders, and very light box shadows. Motion is restrained — entry animations and hover lifts only.

**Key rules:**

- All colored surfaces use semitransparent white (`rgba(255,255,255, 0.5–0.8)`) rather than solid fills.
- Shadows use near-black with very low alpha (`rgba(0,0,0,0.06–0.12)`), never `gray`.
- Rounded corners are generous: `rounded-2xl` (1rem) on cards, `rounded-xl` (0.75rem) on interactive elements, `rounded-full` on badges and avatars.
- Never use Mantine component primitives for new UI — use the custom Radix/CVA-based components described in §11.

---

## 2. Required Dependency: `@/lib/utils`

All component and page files import `cn()` from `@/lib/utils`. This file **must** exist at `src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Required packages: `clsx`, `tailwind-merge`. Both must be listed in `package.json` dependencies.

---

## 3. CSS Design Tokens

All tokens are defined as CSS custom properties in `src/index.css` under `:root`. They are consumed with `hsl(var(--token))`.

### Semantic Color Tokens

| Token                      | HSL Value     | Approximate Color      | Purpose                              |
| -------------------------- | ------------- | ---------------------- | ------------------------------------ |
| `--background`             | `220 20% 97%` | Near-white cool gray   | Page background base                 |
| `--foreground`             | `220 25% 10%` | Very dark blue-gray    | Default body text                    |
| `--card`                   | `0 0% 100%`   | Pure white             | Card background (non-glass mode)     |
| `--card-foreground`        | `220 25% 10%` | Same as foreground     | Card text                            |
| `--popover`                | `0 0% 100%`   | Pure white             | Popover / tooltip background         |
| `--popover-foreground`     | `220 25% 10%` | Dark text              | Popover text                         |
| `--primary`                | `185 65% 45%` | Vivid cyan-teal        | Brand primary, buttons, icons, links |
| `--primary-foreground`     | `0 0% 100%`   | White                  | Text on primary-colored elements     |
| `--secondary`              | `220 15% 92%` | Light cool gray        | Secondary button / badge backgrounds |
| `--secondary-foreground`   | `220 25% 20%` | Dark blue-gray         | Text on secondary elements           |
| `--muted`                  | `220 15% 94%` | Very light cool gray   | Disabled / subdued backgrounds       |
| `--muted-foreground`       | `220 10% 45%` | Medium gray            | Placeholder / helper text            |
| `--accent`                 | `185 50% 94%` | Very light teal tint   | Hover backgrounds on nav items       |
| `--accent-foreground`      | `185 65% 35%` | Deeper teal            | Text on accent-colored backgrounds   |
| `--destructive`            | `0 72% 51%`   | Standard red           | Errors, delete actions               |
| `--destructive-foreground` | `0 0% 100%`   | White                  | Text on destructive elements         |
| `--border`                 | `220 15% 88%` | Light cool-gray border | Dividers, input borders              |
| `--input`                  | `220 15% 88%` | Same as `--border`     | Input field border                   |
| `--ring`                   | `185 65% 45%` | Same as `--primary`    | Focus ring color                     |
| `--radius`                 | `1rem`        | —                      | Base border radius                   |

### Glassmorphism Variables

| Variable         | Value                         | Used In                                    |
| ---------------- | ----------------------------- | ------------------------------------------ |
| `--glass-bg`     | `rgba(255,255,255,0.7)`       | `.glass` base background                   |
| `--glass-border` | `rgba(255,255,255,0.5)`       | `.glass` border                            |
| `--glass-shadow` | `0 8px 32px rgba(0,0,0,0.08)` | `.glass` shadow                            |
| `--glass-blur`   | `16px`                        | `backdrop-filter: blur(var(--glass-blur))` |

---

## 4. Page Background

Applied to the `<body>` element. A fixed multi-layer radial gradient over the base background color:

```css
body {
  background-color: hsl(220 20% 97%);
  background-image:
    radial-gradient(
      ellipse at 20% 0%,
      rgba(6, 182, 212, 0.12) 0%,
      transparent 50%
    ),
    radial-gradient(
      ellipse at 80% 100%,
      rgba(20, 184, 166, 0.1) 0%,
      transparent 50%
    ),
    radial-gradient(
      ellipse at 50% 50%,
      rgba(99, 102, 241, 0.05) 0%,
      transparent 70%
    );
  background-attachment: fixed;
}
```

- Top-left: cyan glow (`rgba(6,182,212,0.12)`) — matches Tailwind `cyan-500`
- Bottom-right: teal glow (`rgba(20,184,166,0.10)`) — matches Tailwind `teal-500`
- Center: faint indigo hint (`rgba(99,102,241,0.05)`) — matches Tailwind `indigo-500`

This background is always fixed (does not scroll with content).

---

## 5. Glassmorphism Utility Classes

Three global utility classes are defined in `src/index.css`. They must not be replicated with inline styles — always use these class names.

### `.glass`

The base glass layer. Used for lighter overlays.

```css
.glass {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}
```

### `.glass-card`

Richer glass for primary surfaces (cards, sidebar, mobile header). This is the default for the `Card` component and the sidebar panel.

```css
.glass-card {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.06),
    0 1px 2px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
```

### `.glass-subtle`

Lightest glass. Used for the mobile sticky header.

```css
.glass-subtle {
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.4);
}
```

---

## 6. Typography

### Font Stacks

**Body / UI text** (applied via Tailwind's default `font-sans` override):

```
"Inter", "IBM Plex Sans", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif
```

**Headings** (set in Mantine theme, applies when Mantine `Title` is used — prefer Tailwind classes for custom headings):

```
"Space Grotesk", "IBM Plex Sans", "Avenir Next", "Segoe UI Variable", sans-serif
font-weight: 700
```

### Heading Base Styles

All `h1`–`h6` elements receive these base styles via `index.css`:

```css
h1,
h2,
h3,
h4,
h5,
h6 {
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
```

### Tailwind Size Scale in Use

| Tailwind Class                                  | Role                                       |
| ----------------------------------------------- | ------------------------------------------ |
| `text-2xl sm:text-3xl font-bold tracking-tight` | Primary page title (H1)                    |
| `text-xl font-bold`                             | Card/section title                         |
| `text-base`                                     | Card subtitle, body emphasis               |
| `text-sm font-semibold`                         | Nav item label, form section heading       |
| `text-xs uppercase tracking-widest`             | Sub-labels (e.g., "Not Found" on 404 page) |
| `text-xs text-muted-foreground`                 | Helper text, timestamps, meta info         |

---

## 7. Scrollbar Styling

Applied globally via `index.css`:

```css
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: hsl(var(--border));
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.3);
}
```

---

## 8. Animations

All keyframes and animation utility classes are defined in `src/index.css`.

### `fade-in` / `.animate-fade-in`

```css
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fade-in {
  animation: fade-in 0.4s ease-out;
}
```

**Used on:** page-level wrappers — `JobPostingsPage`, `AddJobPostingPage`, `LoginPage`, `AuthCallbackPage` success view.

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
  animation: slide-in-right 0.3s ease-out;
}
```

**Used on:** elements that slide in from the left (the name is slightly misleading — it animates from left to center).

### `pulse-glow`

```css
@keyframes pulse-glow {
  0%,
  100% {
    box-shadow: 0 0 0 0 hsl(var(--primary) / 0.3);
  }
  50% {
    box-shadow: 0 0 20px 4px hsl(var(--primary) / 0.15);
  }
}
```

Defined but currently not assigned to a utility class. Reserved for future interactive hover effects on primary elements.

### Hover Motion (Inline Tailwind)

Cards and interactive tiles use:

```
hover:-translate-y-1 hover:shadow-xl transition-all duration-300
```

Buttons use:

```
transition-all duration-200
active:scale-[0.98]       /* default/destructive variants */
```

---

## 9. Layout Architecture

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
`AppLayout` is the single wrapper for all authenticated pages.

### `AppLayout` (`src/components/app-layout.tsx`)

#### Desktop Sidebar (≥ `md`, 768px+)

| Property  | Value                                                      |
| --------- | ---------------------------------------------------------- |
| Position  | `fixed inset-y-0 left-0 z-50`                              |
| Width     | `w-72` (18rem / 288px)                                     |
| Shape     | `rounded-r-3xl` (right side only)                          |
| Surface   | `.glass-card`                                              |
| Padding   | `p-6`                                                      |
| Structure | Three stacked sections (top logo, middle nav, bottom user) |

**Logo section (top of sidebar):**

```
<div class="flex items-center gap-3 px-2 mb-8">
  <!-- Logo mark -->
  <div class="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-teal-600
              text-white font-bold text-sm flex items-center justify-center
              shadow-lg shadow-primary/25">
    CO
  </div>
  <!-- App name -->
  <div>
    <span class="text-lg font-bold tracking-tight">Career OS</span>
    <span class="text-xs text-muted-foreground block">채용 관리 시스템</span>
  </div>
</div>
```

**Navigation section (middle):** See §10.

**User section (bottom of sidebar):**

```
<div class="mt-auto pt-4 border-t border-border/50">
  <!-- Avatar + name + logout button -->
</div>
```

- Avatar: `Avatar` component (h-10 w-10, ring-2 ring-white/60)
- Display name: `text-sm font-medium` + email `text-xs text-muted-foreground`
- Logout button: icon-only `Button` variant `ghost`, `LogOut` icon (`h-4 w-4`)

#### Mobile Header (< `md`)

- Sticky top bar, `h-16`, `.glass-subtle`, `border-b border-white/30`
- Left: hamburger `Button` variant `ghost` with `Menu` / `X` icon toggle
- Center: same logo mark + "Career OS" text
- Right: `Avatar` (h-8 w-8)

#### Mobile Sidebar Overlay

When open:

- Backdrop: `fixed inset-0 bg-black/20 backdrop-blur-sm z-40`
- Sidebar panel: same sidebar content but **without** `rounded-r-3xl` (full height flush)

#### Main Content Area

```
<main class="md:pl-72">
  <div class="max-w-6xl mx-auto px-4 py-6 md:px-8 md:py-10">
    {children}
  </div>
</main>
```

- On mobile: no left padding (sidebar is overlaid, not static)
- On desktop (`md+`): `pl-72` to clear the fixed sidebar

---

## 10. Navigation

### Navigation Items

Defined as a static array in `app-layout.tsx`:

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

To add a new authenticated page, add an entry here.

### Nav Link Anatomy

Each nav item is a `NavLink` (React Router) with the following structure:

```
<NavLink to={href}>
  <div class="flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200
              [inactive: text-muted-foreground hover:bg-accent hover:text-foreground]
              [active: bg-primary/10 text-primary shadow-sm]">

    <!-- Icon container -->
    <div class="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
                [inactive: bg-muted/50]
                [active: bg-primary text-white]">
      <Icon class="h-4 w-4" />
    </div>

    <!-- Text -->
    <div class="flex-1 min-w-0">
      <div class="text-sm font-semibold">{label}</div>
      <div class="text-xs text-muted-foreground [active: text-primary/70]">{description}</div>
    </div>

    <!-- Chevron (only on active item) -->
    <ChevronRight class="h-4 w-4 opacity-0 [active: opacity-100] transition-opacity" />
  </div>
</NavLink>
```

Active state is determined by React Router's `isActive` — exact match only (no partial matching for `/job-postings` vs `/job-postings/new`).

---

## 11. UI Component Specifications

All components live in `src/components/ui/`. They follow the shadcn/ui pattern: Radix UI primitives styled with CVA variants + Tailwind classes. Import `cn` from `@/lib/utils`.

### `Button` (`button.tsx`)

Base class (all variants):

```
inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm
font-semibold ring-offset-background transition-all duration-200
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
disabled:pointer-events-none disabled:opacity-50
```

| Variant       | Classes                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| `default`     | `bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:shadow-lg active:scale-[0.98]` |
| `destructive` | `bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90 active:scale-[0.98]`     |
| `outline`     | `border border-input bg-background/50 backdrop-blur-sm hover:bg-accent hover:text-accent-foreground`   |
| `secondary`   | `bg-secondary text-secondary-foreground hover:bg-secondary/80`                                         |
| `ghost`       | `hover:bg-accent hover:text-accent-foreground`                                                         |
| `link`        | `text-primary underline-offset-4 hover:underline`                                                      |
| `glass`       | `.glass-card hover:bg-white/80 text-foreground shadow-sm hover:shadow-md`                              |

| Size      | Classes                          |
| --------- | -------------------------------- |
| `default` | `h-11 px-5 py-2`                 |
| `sm`      | `h-9 rounded-lg px-3 text-xs`    |
| `lg`      | `h-12 rounded-xl px-8 text-base` |
| `icon`    | `h-10 w-10`                      |

**`loading` prop:** When `true`, renders an inline SVG spinner (24×24, `animate-spin`) and sets `disabled`. The spinner replaces the left-most icon slot.

### `Card` (`card.tsx`)

Component accepts a `glass?: boolean` prop (default `true`).

```
glass=true:  "glass-card hover:shadow-lg rounded-2xl transition-shadow duration-200"
glass=false: "bg-card border border-border shadow-sm rounded-2xl"
```

Sub-components:

| Component         | Classes                                         |
| ----------------- | ----------------------------------------------- |
| `CardHeader`      | `flex flex-col space-y-1.5 p-6`                 |
| `CardTitle`       | `text-xl font-bold leading-none tracking-tight` |
| `CardDescription` | `text-sm text-muted-foreground`                 |
| `CardContent`     | `p-6 pt-0`                                      |
| `CardFooter`      | `flex items-center p-6 pt-0`                    |

### `Badge` (`badge.tsx`)

Base: `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors`

| Variant       | Classes                                                         |
| ------------- | --------------------------------------------------------------- |
| `default`     | `border-transparent bg-primary text-primary-foreground`         |
| `secondary`   | `border-transparent bg-secondary text-secondary-foreground`     |
| `destructive` | `border-transparent bg-destructive text-destructive-foreground` |
| `outline`     | `text-foreground` (border shows through)                        |
| `saramin`     | `border-orange-200 bg-orange-50 text-orange-700`                |
| `wanted`      | `border-teal-200 bg-teal-50 text-teal-700`                      |
| `glass`       | `border-white/40 bg-white/50 backdrop-blur-sm text-foreground`  |

Platform badges (`saramin`, `wanted`) are used exclusively for the job posting platform label. Always pick the correct variant rather than the generic `default`.

### `Input` (`input.tsx`)

```
h-11 w-full rounded-xl border border-input bg-white/70 backdrop-blur-sm
px-4 py-2 text-sm placeholder:text-muted-foreground
hover:border-primary/50
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1
disabled:cursor-not-allowed disabled:opacity-50
transition-colors
```

Error state (add via `className` or an `error` prop wrapper):

```
border-destructive focus-visible:ring-destructive
```

### `Textarea` (`textarea.tsx`)

Same styling as `Input` with additions:

```
min-h-[100px] py-3 resize-none
```

### `Label` (`label.tsx`)

```
text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70
```

### `Alert` (`alert.tsx`)

Base: `relative w-full rounded-xl border p-4 [&>svg~*]:pl-7 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4`

| Variant       | Classes                                                    |
| ------------- | ---------------------------------------------------------- |
| `default`     | `bg-background/80 backdrop-blur-sm text-foreground`        |
| `destructive` | `border-destructive/30 bg-destructive/10 text-destructive` |
| `success`     | `border-green-200 bg-green-50 text-green-800`              |
| `warning`     | `border-yellow-200 bg-yellow-50 text-yellow-800`           |

`AlertTitle`: `mb-1 font-semibold leading-none tracking-tight`  
`AlertDescription`: `text-sm [&_p]:leading-relaxed`

### `Avatar` (`avatar.tsx`)

Built on `@radix-ui/react-avatar`.

`AvatarRoot`: `relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-white/60 shadow-sm`  
`AvatarImage`: `aspect-square h-full w-full object-cover`  
`AvatarFallback`: `flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold text-sm`

Fallback renders the first letter(s) of the user's display name. Do not show an email address as the fallback.

### `Separator` (`separator.tsx`)

`bg-border/60`

- Horizontal: `h-[1px] w-full`
- Vertical: `h-full w-[1px]`

### `Skeleton` (`skeleton.tsx`)

```
animate-pulse rounded-lg
bg-gradient-to-r from-muted/60 via-muted to-muted/60
bg-[length:200%_100%]
```

Produces a left-to-right shimmer. Use for any loading placeholder.

---

## 12. Recurring Visual Patterns

These patterns appear across multiple pages. Always use them consistently.

### Brand Gradient (Logo Mark)

```
bg-gradient-to-br from-primary to-teal-600
```

Used on: sidebar logo, mobile header logo, login page logo, empty state icon container on `JobPostingsPage`.  
Logo container shape: `rounded-xl` (sidebar), `rounded-2xl` (login), `rounded-2xl` (empty state — without the logo text, just an icon).

### Decorative Blobs (Behind-the-scene gradients)

```
bg-gradient-to-br from-primary/20 to-teal-500/10 rounded-full blur-3xl
```

Positioned absolutely, `pointer-events-none`. Used on `LoginPage` (two blobs: top-right + bottom-left).

### Form / Accent Card Header Strip

```
bg-gradient-to-r from-primary/5 to-teal-500/5
```

Used as `CardHeader` background on `AddJobPostingPage` phase 2.

### Icon in Gradient Container (Feature icons)

```
<div class="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-teal-500/10
            flex items-center justify-center">
  <Icon class="h-8 w-8 text-primary" />
</div>
```

Used on: empty state on `JobPostingsPage` (`Sparkles` icon), `NotFoundPage` uses `bg-gradient-to-br from-muted/50 to-muted` variant.

### Spinner with Glow (Auth callback)

```
<div class="relative">
  <div class="absolute inset-0 bg-gradient-to-br from-primary/30 to-teal-500/20
              blur-xl rounded-full scale-150" />
  <Loader2 class="h-10 w-10 text-primary animate-spin relative z-10" />
</div>
```

---

## 13. Responsive Breakpoints

Tailwind defaults are used. No custom breakpoints.

| Breakpoint | Min Width | Key Layout Change                                                               |
| ---------- | --------- | ------------------------------------------------------------------------------- |
| (default)  | 0px       | Single column card grid; stacked page header; mobile AppLayout (sticky top bar) |
| `sm`       | 640px     | 2-column card grid; page header becomes `flex-row`; form grids 2-col            |
| `md`       | 768px     | Static sidebar visible; `main` gets `pl-72`; mobile header hidden               |
| `lg`       | 1024px    | 3-column card grid; working conditions form grid becomes 3-col                  |

---

## 14. Accessibility & Focus States

**Global focus ring** (all focusable elements):

```css
:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
```

`--ring` is `185 65% 45%` (same as `--primary`), so focus rings are teal.

**Text selection:**

```css
::selection {
  background: rgba(6, 182, 212, 0.2);
}
```

**Disabled state:** All interactive components use `disabled:pointer-events-none disabled:opacity-50`.

**Screen reader support:** Use `sr-only` for icon-only buttons (e.g., logout button, mobile hamburger). Radix UI primitives provide correct ARIA roles automatically.

---

## 15. Mantine Configuration Notes

`MantineProvider` wraps the app root for theme consistency, but **no Mantine component primitives are used anywhere in the UI**. The Mantine theme is configured in `src/app/theme.ts`:

```ts
{
  primaryColor: 'orange',    // intentionally different from CSS --primary; not actually rendered
  defaultRadius: 'md',
  fontFamily: 'IBM Plex Sans, Avenir Next, Segoe UI Variable, Segoe UI, sans-serif',
  headings: {
    fontFamily: 'Space Grotesk, IBM Plex Sans, Avenir Next, Segoe UI Variable, sans-serif',
    fontWeight: '700',
  },
}
```

**Rule:** Do not add new Mantine component usages. All new UI must use the `src/components/ui/` primitives described in §11.

---

## Quick Checklist for New Pages

When adding a new authenticated page:

- [ ] Add a `navigationItems` entry in `app-layout.tsx` (§10)
- [ ] Add a route inside `ProtectedRoute → AppLayout` in `router.tsx` (§9)
- [ ] Wrap the page root element with `animate-fade-in` class
- [ ] Use `max-w-6xl mx-auto` (handled by `AppLayout`) — do not add extra centering wrappers
- [ ] Use `Card` with default `glass` prop for content panels
- [ ] Use `Button` variants from §11 — never raw `<button>`
- [ ] Korean UI labels throughout (this is a Korean-language product)
- [ ] Icons from `lucide-react` only
- [ ] Import `cn` from `@/lib/utils` if conditional class merging is needed
