# Hexa Cold Calling Frontend

Next.js App Router frontend for the Hexa cold-calling workflow. The app talks to the FastAPI backend for auth, contacts, call tracking, imports, Gmail follow-up, reporting, and a standalone team to-do list.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The backend defaults to `http://localhost:8000` when `NEXT_PUBLIC_API_URL` is not set.

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
- `__tests__/`: Vitest and React Testing Library coverage for pages/components.

## Development Notes

Most authenticated routes use `AuthGuard` plus `AppSidebar`, then fetch data from the backend through `apiFetch`. Tests mock `@/lib/api`, `next/navigation`, and layout wrappers in `__tests__/setup.tsx`.
