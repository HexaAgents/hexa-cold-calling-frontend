# Hexa Cold Calling Frontend

Next.js App Router frontend for the Hexa cold-calling workflow. The app talks to the FastAPI backend for auth, contacts, call tracking, imports, Gmail follow-up, reporting, and a standalone team to-do list.

## Tech Stack

- Next.js 16 App Router, React 19, and TypeScript.
- Tailwind CSS v4 with shadcn/Radix-style UI primitives.
- Responsive layout: desktop UI above the `lg` (1024px) breakpoint, mobile UI below it (drawer navigation, card lists, native `tel:` dialing).
- Vitest, React Testing Library, and jsdom for component and route behavior tests.

## Setup

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`. The backend defaults to `http://localhost:8000` when `NEXT_PUBLIC_API_URL` is not set.

### Testing on a phone (LAN access)

To use the app from a phone on the same network:

1. Find the Mac's LAN IP (for example `ipconfig getifaddr en0`).
2. Set `NEXT_PUBLIC_API_URL=http://<LAN_IP>:8000` in `.env.local`.
3. Start the backend bound to all interfaces with the LAN origin allowed:
   `ALLOWED_ORIGINS="http://localhost:3000,http://<LAN_IP>:3000" .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`
4. Start the frontend with `npm run dev -- -H 0.0.0.0` and open `http://<LAN_IP>:3000` on the phone.

Twilio browser calling requires a secure (HTTPS) context, so it stays desktop-only; on mobile the Call Tracker shows a native `tel:` Call button instead and outcomes are logged the same way after the call.

## Scripts

- `npm run dev`: start the Next.js dev server.
- `npm run lint`: run ESLint.
- `npm test`: run Vitest once.
- `npm run test:watch`: run Vitest in watch mode.
- `npm run build`: build the production app.

There is no separate `typecheck` script; `next build` performs the production TypeScript/Next validation.

## Environment

- `NEXT_PUBLIC_API_URL`: backend API base URL, for example `http://localhost:8000`.

The client stores `access_token` and `user` in `localStorage` after login and sends the token with API requests through `src/lib/api.ts`.

## Project Structure

- `src/app/`: App Router pages and route-level UI. See `src/app/README.md`.
- `src/components/layout/`: authenticated shell, sidebar, auth guard, and logo. See `src/components/layout/README.md`.
- `src/components/ui/`: shared shadcn-style primitives.
- `src/lib/`: backend API client and utilities. The frontend talks only to the FastAPI backend (via `apiFetch`); it never connects to the database directly.
- `src/types/`: shared frontend TypeScript interfaces matching backend schemas.
- `__tests__/`: Vitest and React Testing Library coverage for pages/components and shared utilities. See `__tests__/README.md`.

## Development Notes

All authenticated routes use `AuthGuard` plus the shared `AppShell` (`src/components/layout/app-shell.tsx`), then fetch data from the backend through `apiFetch`. `AppShell` renders the fixed 248px `AppSidebar` on desktop and a sticky header with a slide-over drawer below `lg`. Tests mock `@/lib/api`, `next/navigation`, and layout wrappers in `__tests__/setup.tsx`.

Responsive conventions:

- The desktop/mobile cutoff is the `lg` (1024px) Tailwind breakpoint; desktop layouts are unchanged above it.
- Wide tables (Contacts, Companies, Email Tracking, To-Do) render a `hidden lg:block` table plus a `lg:hidden` card list. Both variants are in the DOM, so jsdom tests must account for duplicated text (see `__tests__/README.md`).
- Hover-only reveals use `opacity-100 lg:opacity-0 lg:group-hover:opacity-100` so actions stay visible on touch devices.
- Dialogs are capped at `max-h-[85dvh]` with internal scrolling via the shared `DialogContent` primitive.

## Test Coverage

The test suite focuses on user-visible behavior and API payload contracts rather than implementation details.

- Auth and navigation: login, auth-guarded pages, sidebar active state, app-shell drawer behavior, and logo accessibility.
- Calling workflow: call tracker queue behavior, claim/session state, UI actions around call outcomes, and company flags (flag a company with a suggested or custom reason; a warning banner appears whenever any contact from that company comes up, without removing it from the pool).
- Imports and reporting: CSV import page states and productivity table/summary rendering.
- Settings: settings form rendering, editing, and submission behavior.
- To-do list: table columns, due-date sorting, multi-assignee pills, assigner/assignee permissions, task creation payloads, detail-page editing rules, overdue warnings, and muted amber overdue styling.
- Shared utilities: multi-assignee normalization and payload construction in `src/lib/todo-assignees.ts`.

Run `npm test` before pushing UI behavior changes. Run `npm run lint` after class name, hook, or accessibility changes. Run `npm run build` when changing Next.js config, route boundaries, environment variables, or TypeScript contracts.

## Documentation Map

- `src/app/README.md`: route map, data flow, and route-level testing notes.
- `src/components/layout/README.md`: authenticated shell, sidebar, logo, and layout test notes.
- `__tests__/README.md`: testing conventions, mocks, and coverage map.
