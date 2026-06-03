# Frontend Test Suite

This directory contains the Vitest and React Testing Library tests for the Next.js frontend. Tests are intentionally written around visible behavior, accessibility labels, navigation calls, and backend API payloads so they remain useful when component internals change.

## Setup

- `vitest.config.ts` runs tests in `jsdom` and loads `__tests__/setup.tsx`.
- `__tests__/setup.tsx` mocks `next/navigation`, `@/lib/api`, `AuthGuard`, `AppSidebar`, and `localStorage`.
- Page tests should mock `apiFetch` by path because most routes fetch more than one endpoint on mount.
- New component tests should prefer `getByRole`, `getByLabelText`, and visible copy before falling back to `data-testid`.

## Coverage Map

- `components/login.test.tsx`: login form rendering, validation, and auth API behavior.
- `components/app-sidebar.test.tsx`: sidebar navigation, active route state, sign out behavior, and current-user display.
- `components/hexa-logo.test.tsx`: logo accessibility and optional wordmark rendering.
- `components/call-tracker.test.tsx`: call queue display, call actions, prompt states, and route-level behavior around the calling workflow.
- `components/import-page.test.tsx`: CSV upload states, import status polling, retry/download affordances, and backend payload expectations.
- `components/productivity-page.test.tsx`: productivity filters, summary cards, and breakdown rendering.
- `components/settings-form.test.tsx`: settings loading, editing, save payloads, and error handling.
- `components/todo-list-page.test.tsx`: to-do table columns, sorting, assignee pills, person filter availability, assigner/assignee controls, task creation, overdue state, and muted amber overdue styling.
- `components/todo-list.test.tsx`: multi-assignee rendering and row navigation for the to-do list.
- `components/todo-detail-page.test.tsx`: task detail rendering, assigner-only delete behavior, assignee edit behavior, multi-assignee permissions, and overdue warnings.
- `lib/todo-assignees.test.ts`: canonical multi-assignee helpers, legacy field fallback, and payload construction.

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
