# Career OS — Frontend Design Specification

The implementation is the source of truth. This document describes the StyleX
styling system, shared component contracts, and the visual patterns used by the
frontend. Keep it aligned when those patterns change.

## Visual language

Career OS uses translucent glass surfaces over a white background, with teal
accents (`hsl(185 72% 42%)`). Blurred cyan, teal, and purple gradient circles add
depth behind the content. Dark, low-opacity borders and restrained shadows keep
panels distinct. Cards have a 1rem radius, controls generally use 0.75rem, and
badges and avatars are pill-shaped.

Primary action labels and body copy are Korean. Brand labels, platform IDs, and
page super-labels retain their implemented wording. Icons use `lucide-react`;
the login button includes an inline Google brand SVG.

## Styling architecture

- `@stylexjs/stylex` owns component and page styles. Module-level
  `stylex.create()` declarations compile to atomic CSS through
  `@stylexjs/unplugin` in `vite.config.ts`.
- Native elements and third-party icon components receive
  `{...stylex.props(styles.base, condition && styles.active)}`.
- Shared UI components accept an `xstyle` prop. They compose their base,
  variant, size, and caller styles before converting them to DOM props.
  Caller styles take precedence on conflicting properties.
- `src/lib/styles.ts` defines `AppStyles` and `withClassName()`. The latter
  preserves an optional opaque `className` for interoperability; it does not
  interpret utility strings or resolve CSS conflicts between opaque classes.
- `src/styles/surfaces.ts` contains glass, button, and input surfaces.
  `src/styles/motion.ts` contains compiled keyframes and motion preferences.
- `src/index.css` owns the browser reset, semantic CSS variables, document
  defaults, focus/selection/scrollbar styling, and two structural selectors:
  stack child spacing and deferred rendering of later posting cards.
- Vitest uses the official StyleX Babel plugin without CSS injection. Component
  tests check semantics and composition; browser checks cover the CSS cascade,
  responsive breakpoints, pseudo-states, and geometry.

```tsx
import * as stylex from "@stylexjs/stylex";
import { Button } from "@/components/ui/button";

const styles = stylex.create({
  actions: {
    display: "flex",
    gap: "0.75rem",
    flexDirection: {
      default: "column",
      "@media (min-width: 40rem)": "row",
    },
  },
  submit: { minWidth: "8rem" },
});

<div {...stylex.props(styles.actions)}>
  <Button xstyle={styles.submit}>저장</Button>
</div>;
```

Use explicit border and background properties when defining surfaces. A
conditional property replaces that property from preceding styles, so include
its intended default alongside hover or media-query values. Do not rely on
stylesheet order to merge independently generated class names.

## Semantic colors and typography

CSS custom properties are declared in `src/index.css`. StyleX references colors
with `hsl(var(--token))`; translucent variants use `color-mix()` or HSL alpha.
Changing a token updates every reference.

| Token                      | HSL channels  | Role                         |
| -------------------------- | ------------- | ---------------------------- |
| `--background`             | `0 0% 100%`   | Page background              |
| `--foreground`             | `0 0% 9%`     | Body text                    |
| `--card`                   | `210 20% 98%` | Card color token             |
| `--card-foreground`        | `222 47% 11%` | Card text                    |
| `--popover`                | `0 0% 100%`   | Popover background           |
| `--popover-foreground`     | `222 47% 11%` | Popover text                 |
| `--primary`                | `185 72% 42%` | Brand and primary actions    |
| `--primary-foreground`     | `0 0% 100%`   | Primary action text          |
| `--secondary`              | `210 20% 96%` | Secondary backgrounds        |
| `--secondary-foreground`   | `222 47% 11%` | Secondary text               |
| `--muted`                  | `210 20% 96%` | Subdued backgrounds          |
| `--muted-foreground`       | `215 16% 35%` | Helper text and placeholders |
| `--accent`                 | `185 40% 94%` | Accent fills                 |
| `--accent-foreground`      | `185 72% 32%` | Accent text                  |
| `--destructive`            | `0 72% 51%`   | Errors                       |
| `--destructive-foreground` | `0 0% 100%`   | Destructive action text      |
| `--border`, `--input`      | `214 20% 88%` | Borders and dividers         |
| `--ring`                   | `185 72% 42%` | Focus outlines               |

`--radius` is `1rem`. The document font stack is Inter, IBM Plex Sans, Segoe UI
Variable, Segoe UI, system-ui, sans-serif. Headings retain bold weight, a 1.25
line height, and slightly tightened tracking. Native controls inherit document
or parent typography; slotted links retain the button's explicit size styles.
Secondary text ranges from 0.75rem to 0.875rem; page headings grow at the small
breakpoint. Neutral and status colors use explicit OKLCH values in StyleX.

## Surfaces

| Style in `surfaces` | Appearance and use                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `glass`             | White at 70% opacity, a white gradient, 20px blur with 120% saturation, a subtle dark border, and outer/inset shadows. Default cards. |
| `glassStrong`       | White at 85% opacity with a stronger gradient and 24px blur. Sidebar, mobile header, drawer, assistant shell.                         |
| `glassLight`        | White at 55% opacity with 12px blur and a light inset shadow. Chips and secondary controls.                                           |
| `glassHover`        | Complete glass defaults plus a stronger hover background/shadow and a 2px upward lift. Reduced motion removes the lift.               |
| `surface`           | White at 75% opacity, a subtle border and shadow, without blur. Non-glass cards.                                                      |
| `btnPrimary`        | Teal gradient, white bold text, and teal shadow. Hover brightens the gradient.                                                        |
| `btnSecondary`      | Subtle dark fill/border, strengthened on hover.                                                                                       |
| `btnGhost`          | Transparent fill with muted text; hover adds a subtle fill and foreground text.                                                       |
| `inputClean`        | Subtle dark fill/border and inset shadow, muted placeholder, teal focus border and shadow.                                            |

## Motion and structural layout

`motion.fadeIn` enters from 12px below over 0.4s. `motion.slideIn` enters from
12px left over 0.3s. Both use an opacity-only 0.2s animation when reduced motion
is requested. Pulse and spinner animations stop under reduced motion. The
indeterminate progress indicator stops sweeping and fills its track instead.
Loading and completion remain available through visible text and live regions.

A container with `data-stack` uses its StyleX `--stack-space` value for the
bottom margin of each non-last direct child. Keep the attribute and spacing
style together. `CardHeader` supplies this relationship by default.

The posting grid uses `data-postings-grid`. Cards from the seventh onward use
`content-visibility: auto` and an intrinsic block-size estimate of 220px. The
first six cards render immediately. Unsupported browsers render normally.

## Shared UI contracts

All public primitives live in `src/components/ui/`. Pages reuse these primitives
instead of importing equivalent library controls.

| Component                        | Contract                                                                                                                                                                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                         | Variants: default, destructive, outline, secondary, ghost, link, glass. Sizes: default, sm, lg, icon. Loading inserts a decorative spinner; native buttons default to disabled while loading. `asChild` preserves the Radix Slot/Slottable composition for links. |
| `Badge`                          | Variants: default, secondary, destructive, success, warning, outline, saramin, wanted, glass. Compact pill with status/platform color.                                                                                                                            |
| `Card`                           | Glass by default; `glass={false}` selects the solid surface. `interactive` enables hover feedback and pointer cursor.                                                                                                                                             |
| Card sections                    | Header is a vertical stack with 1.5rem padding. Content/footer default to 1.5rem padding with no top padding. Caller overrides compose by property.                                                                                                               |
| `Input`, `Textarea`              | Shared clean input surface, rounded corners, disabled state, and `error` linked to `aria-invalid`. Textarea has a 6rem minimum height and disables resizing.                                                                                                      |
| `Label`                          | Associates with controls through caller-supplied `htmlFor`.                                                                                                                                                                                                       |
| `TagInput`                       | Enter/comma adds trimmed, unique tags; blur commits pending text; Backspace on an empty input removes the last tag. Error and description attributes reach the inner input.                                                                                       |
| `Alert`                          | Decorative content uses the explicit `icon` slot. Destructive/warning variants default to assertive alerts; informational variants use polite status. Callers may override role and politeness.                                                                   |
| `AlertTitle`, `AlertDescription` | Styled heading and description content inside an alert.                                                                                                                                                                                                           |
| `LiveRegion`                     | Persistently mounted, visually hidden announcements; polite by default, optionally assertive.                                                                                                                                                                     |
| Avatar primitives                | Radix owns image loading/fallback behavior. StyleX owns circular sizing, clipping, colors, and image fit.                                                                                                                                                         |
| `Skeleton`                       | Rounded gradient placeholder with reduced-motion-aware pulse.                                                                                                                                                                                                     |
| `Separator`                      | Horizontal or vertical decorative divider, hidden from assistive technology.                                                                                                                                                                                      |
| `Dialog`                         | Required title plus `opened`/`onClose` boundary. Mantine owns focus trap, Escape, scroll lock, and restoration; StyleX supplies overlay, panel, header, body, title, and close-control styles through `classNames`.                                               |

`xstyle` accepts compiled StyleX styles and conditional arrays, including the
app's stack spacing property. Raw style objects and utility strings are not the
component styling contract. Runtime StyleX style functions may be used for
values that cannot be known at build time.

## Layout and navigation

The desktop sidebar is fixed, 16rem wide, and fills the viewport height. Content
has matching left padding and is constrained to 72rem, with responsive gutters.
The sidebar contains brand identity, route links, and the user/logout area.
Active links use teal fill/border; inactive links have hover feedback. StyleX
markers express ancestor-hover relationships.

Below 48rem, a sticky header replaces the sidebar. The mobile menu uses a native
modal `<dialog>` with a maximum width of 80vw. The browser owns focus trapping,
inert background, Escape handling, and restoration; the application owns body
scroll locking and backdrop-click dismissal. A focus-revealed skip link targets
`#main-content`.

The assistant is a separate non-modal dialog. It is mounted lazily, then hidden
on close without discarding the ChatKit session. Opening and closing restore
focus appropriately; Escape closes history before closing the panel. On mobile
it has 0.75rem side/bottom insets and a 4rem top inset. On desktop it sits 1.5rem
from the right/bottom, with viewport-constrained 420px width and 680px height.
ChatKit's embedded interior uses its own theme API.

## Page patterns

| Page                   | Layout and states                                                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JobPostingsPage`      | Floating heading, summary chips, registration link, and group filters. One/two/three-column card grid for data and skeletons. Error panel with retry, centered empty state with CTA, and pagination.                                              |
| Posting cards          | Interactive glass, clipped status accent bar, platform/status badges, company and two-line title, stretched detail link, independent original-posting link, detail panel, deadline/salary chips, and up to five tech tags plus an overflow badge. |
| `JobPostingDetailPage` | Back action, loading skeleton or retry panel, company/title metadata, status/group/memo controls, section cards for populated fields, and artifact generation.                                                                                    |
| `AddJobPostingPage`    | URL extraction card followed by editable form sections and save/cancel footer. Responsive field grids, linked field errors, tag inputs, request alerts, and a centered success card with next actions.                                            |
| `JobSearchGroupsPage`  | Separate active/ended card grids. Shared dialogs for create/edit/delete. Forms submit with Enter, focus the name field initially, and return focus to an invalid name. Request errors remain separate from field errors.                          |
| `ProfilePage`          | Career-profile form with onboarding, loading, retry, validation, and save feedback. Shared controls, tag inputs, and live announcements.                                                                                                          |
| `StrategistPage`       | Profile/group preconditions, plan generation, progress indicator, prioritized fit cards, and explicit proposed-action controls. Handles unavailable feature, loading, error, and empty-plan states.                                               |
| `LoginPage`            | Centered glass card up to 28rem wide, three ambient blobs, brand mark, short introduction, Google action, capabilities list, and disclaimer.                                                                                                      |
| `AuthCallbackPage`     | Centered glass card up to 24rem wide, two ambient blobs, spinner/glow, and status text.                                                                                                                                                           |
| `NotFoundPage`         | Centered card with icon, explanation, and navigation action.                                                                                                                                                                                      |
| Route failures         | Shared error boundary provides a readable recovery surface; protected-route loading uses the same visual language.                                                                                                                                |

## Responsive breakpoints

StyleX property conditions preserve the existing thresholds.

| Minimum width    | Layout change                                                        |
| ---------------- | -------------------------------------------------------------------- |
| Default          | Single-column cards, stacked headers, mobile navigation              |
| `40rem` (640px)  | Two-column grids and horizontal form/header arrangements             |
| `48rem` (768px)  | Fixed sidebar, larger content gutters, floating assistant dimensions |
| `64rem` (1024px) | Three-column grids and wider header arrangements                     |

## Accessibility and global styling

Keyboard focus uses a 2px teal outline with an offset; components can specialize
it with StyleX pseudo-states. Posting cards expose focus when their link is
focused. Icon-only controls have accessible names. Native disabled controls,
field error descriptions, and live-region semantics remain part of the shared
component boundary.

Text selection uses a translucent cyan fill. The narrow scrollbar has a
translucent dark thumb that strengthens on hover. The CSS reset preserves
native hidden behavior, image sizing, control inheritance, and predictable
box sizing without depending on a styling framework's preflight.

## Mantine boundary

`MantineProvider` remains in `src/app/providers.tsx`. Its theme is configured in
`src/app/theme.ts` with teal primary color, medium radius, IBM Plex Sans body
font, and Space Grotesk heading stack. Mantine is restricted to the shared modal
behavior boundary. Pages use project primitives; StyleX owns their visual
styling.
