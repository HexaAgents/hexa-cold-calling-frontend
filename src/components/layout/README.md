# Layout Components

Shared authenticated layout components live here. All app routes render through `AuthGuard` plus `AppShell`, which owns the responsive chrome around a scrollable page content area.

## Components

- `app-shell.tsx`: responsive shell shared by every authenticated page. Above the `lg` (1024px) breakpoint it renders the fixed 248px `AppSidebar` next to the scrollable `main` (plus the thin primary gradient hairline). Below `lg` it renders a sticky top header (hamburger, Hexa logo, optional page title) and opens the sidebar as a slide-over drawer; the drawer closes on navigation (state adjusted during render off `usePathname`) and on overlay/close-button taps. Accepts `user`, optional `title`, and optional `mainClassName` (used by the to-do list for `scrollbar-gutter`).
- `auth-guard.tsx`: client-side guard that reads `access_token` and `user` from `localStorage`. It redirects unauthenticated users to `/login`, defers setting parsed user state until after mount, and exposes the authenticated user through a render prop.
- `app-sidebar.tsx`: dark left navigation rail with the Hexa logo, route links, sign out, and the current user card. Active state comes from `usePathname`. Rendered by `AppShell` (desktop rail and mobile drawer); pages should not import it directly.
- `hexa-logo.tsx`: image-based logo using `/hexa-logo.png` with alt text `Hexa`; optional `showText` renders the wordmark beside the image.

## Navigation

The sidebar links to Contacts, Companies, Call Tracker, Scheduled Calls, To-Do (`/todo-list`), Email Tracking, Productivity, Import, LinkedIn Templates, and Settings. Contacts is active for `/` and `/contacts/*`; other items use prefix matching.

## Testing Notes

`__tests__/setup.tsx` mocks `AuthGuard` and `AppSidebar` so page tests can focus on page behavior instead of auth and navigation chrome. `AppShell` is **not** mocked: it renders for real in page tests, which means the mobile header title appears in the DOM alongside the page `h1` (query headings by role where this matters). `__tests__/components/app-shell.test.tsx` covers the drawer open/close behavior directly. Logo tests assert the accessible image role/name and optional wordmark text.

When changing layout components, check page tests that rely on shared mocks and run both `npm run lint` and `npm test`.
