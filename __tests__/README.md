# Frontend Test Suite

This directory contains the Vitest and React Testing Library tests for the Next.js frontend. Tests are intentionally written around visible behavior, accessibility labels, navigation calls, and backend API payloads so they remain useful when component internals change.

## Setup

- `vitest.config.ts` runs tests in `jsdom` and loads `__tests__/setup.tsx`.
- `__tests__/setup.tsx` mocks `next/navigation`, `@/lib/api`, `AuthGuard`, `AppSidebar`, and `localStorage`. `AppShell` is not mocked and renders for real, so the mobile header (including the optional page title) is present in page tests.
- Page tests should mock `apiFetch` by path because most routes fetch more than one endpoint on mount.
- New component tests should prefer `getByRole`, `getByLabelText`, and visible copy before falling back to `data-testid`.
- Responsive dual rendering: pages with table/card layouts render both the mobile card list and the desktop table in the DOM (visibility is CSS-only, which jsdom ignores). Use `getAllBy*`/`queryAllBy*` for row content, `getByRole("heading", ...)` for page titles, and `closest("tr")` when a test needs the table variant specifically.

## Coverage Map

- `components/login.test.tsx`: login form rendering, validation, and auth API behavior.
- `components/app-shell.test.tsx`: responsive shell chrome — main content rendering, mobile header title, and drawer open/close via hamburger, close button, and overlay.
- `components/app-sidebar.test.tsx`: sidebar navigation, active route state, sign out behavior, and current-user display.
- `components/hexa-logo.test.tsx`: logo accessibility and optional wordmark rendering.
- `components/call-tracker.test.tsx`: call queue display, call actions, prompt states, route-level behavior around the calling workflow, and company flags — warning banner rendering for flagged companies, flag dialog with suggested/custom reasons and details, save-disabled-until-reason, PUT/DELETE payloads, and banner removal.
- `components/import-page.test.tsx`: CSV upload states, import status polling, retry/download affordances, and backend payload expectations.
- `components/productivity-page.test.tsx`: productivity filters, summary cards, and breakdown rendering.
- `components/settings-form.test.tsx`: settings loading, editing, save payloads, and error handling.
- `components/todo-list-page.test.tsx`: to-do table columns (including the AI Estimate column), sorting, assignee pills, person filter availability, assigner/assignee controls, task creation (including the due date defaulting to the upcoming Sunday and being clearable), overdue state, muted amber overdue styling, AI estimate states (pending "Estimating…", hour-range badge, reported actuals), and the actual-hours dialog flow on tick-done (save quick-pick, skip, and no dialog on un-tick).
- `components/todo-list.test.tsx`: multi-assignee rendering and row navigation for the to-do list.
- `components/todo-detail-page.test.tsx`: task detail rendering, assigner-only delete behavior, assignee edit behavior, multi-assignee permissions, overdue warnings, the AI estimate display, and the actual-hours dialog after marking a task done.
- `lib/todo-assignees.test.ts`: canonical multi-assignee helpers, legacy field fallback, and payload construction.
- `lib/utils.test.ts`: date helpers — `upcomingSundayLocalISO` across weekdays, Sunday-today, and month/year boundaries.

## What to Add When Features Change

- Add or update a test whenever route copy, permissions, sorting, filtering, API payloads, or navigation behavior changes.
- For API-backed pages, assert both the rendered state and the request path/method/body sent through `apiFetch`.
- For auth-sensitive behavior, rely on the shared `AuthGuard` mock unless the auth guard itself is what changed.
- For styling changes, assert semantics first. Class assertions are appropriate only when the class is the behavior being protected, such as the to-do overdue muted amber treatment.

## Commands

```bash
npm test
npm test -- __tests__/components/todo-list-page.test.tsx
npm run lint
npm run build
```
