# Layout Components

Shared authenticated layout components live here. Most app routes render through `AuthGuard`, `AppSidebar`, and a scrollable page content area.

## Components

- `auth-guard.tsx`: client-side guard that reads `access_token` and `user` from `localStorage`. It redirects unauthenticated users to `/login`, defers setting parsed user state until after mount, and exposes the authenticated user through a render prop.
- `app-sidebar.tsx`: dark left navigation rail with the Hexa logo, route links, sign out, and the current user card. Active state comes from `usePathname`.
- `hexa-logo.tsx`: image-based logo using `/hexa-logo.png` with alt text `Hexa`; optional `showText` renders the wordmark beside the image.

## Navigation

The sidebar links to Contacts, Companies, Call Tracker, Scheduled Calls, To-Do (`/todo-list`), Email Tracking, Productivity, Import, LinkedIn Templates, and Settings. Contacts is active for `/` and `/contacts/*`; other items use prefix matching.

## Testing Notes

`__tests__/setup.tsx` mocks `AuthGuard` and `AppSidebar` so page tests can focus on page behavior instead of auth and navigation chrome. Logo tests assert the accessible image role/name and optional wordmark text.

When changing layout components, check page tests that rely on shared mocks and run both `npm run lint` and `npm test`.
