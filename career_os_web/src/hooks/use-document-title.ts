import { useEffect } from 'react';

const SITE_NAME = 'Career OS';

/**
 * Sets `document.title` for the current route.
 *
 * A client-side SPA navigation does not change the document title on its own,
 * so without this every screen keeps the static `index.html` title. That hurts
 * screen-reader users (the tab/announcement never reflects where they are) and
 * browser-history readability. Each routed page calls this with its own label;
 * the next page overwrites it on navigation, so no cleanup is required.
 *
 * We set `document.title` imperatively instead of rendering React 19's
 * hoisted `<title>` element because rendering more than one `<title>` at a
 * time (e.g. the static one in `index.html`, or during a lazy-route Suspense
 * gap) is undefined behavior; an effect-driven assignment is deterministic.
 *
 * @param title Route-specific label, already localized (Korean). Falsy values
 *   fall back to the bare site name.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
  }, [title]);
}
