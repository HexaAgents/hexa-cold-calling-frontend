# App Routes

This directory contains Next.js App Router pages. Authenticated pages share the same shell: `AuthGuard` plus `AppShell` (`src/components/layout/app-shell.tsx`), which renders the sidebar, scrollable `main`, and the thin primary gradient hairline — as a fixed rail on desktop and a header + slide-over drawer below the `lg` breakpoint.

Pages are responsive: wide tables pair a `hidden lg:block` table with a `lg:hidden` card list, grids stack on small screens, and phone numbers become `tel:` links on mobile (Twilio browser calling stays desktop-only because WebRTC needs a secure context).

## Route Map

- `/`: redirects to `/contacts`.
- `/login`: email/password login. Stores `access_token` and serialized `user` in `localStorage`.
- `/contacts`: paginated contact table with sorting and call outcome filters.
- `/contacts/[id]`: contact detail, notes, call history, and delete action.
- `/companies`: company directory with list and detail views.
- `/call-tracker`: filtered one-contact-at-a-time calling workflow with Twilio browser calls (desktop) or native `tel:` dialing (mobile), outcomes, callback dates, notes, email prompts, session history, and claim timeout handling.
- `/scheduled-calls`: follow-up calls across users, with overdue/countdown badges and complete/cancel actions.
- `/todo-list`: standalone team to-do list. Sortable task table (Task, Assigned to, Assigned by, Due date) sorted with unfinished tasks first, then finished tasks, with each group ordered by closest due date (no-due-date tasks last). Tasks are grouped into three sections: **Upcoming** (open tasks that aren't overdue), **Overdue** (open tasks past their due date), and **Complete** (tasks marked done). Includes multi-assignee person pills, full-row navigation to details, subtle overdue highlighting, a per-person filter (available to everyone), and a create dialog (only the task name is required). The assigner and any assigned person can edit/reassign/mark done; delete remains assigner-only.
- `/todo-list/[id]`: task detail page showing the full description (hidden on the table) with multi-assignee edit controls, metadata cards, edit access for assignees, and assigner-only delete actions.
- `/email-tracking`: Gmail conversation tracking for sent follow-ups and replies.
- `/productivity`: call outcomes, conversion flow, and team performance reporting.
- `/import`: Apollo CSV upload, import progress, filtered CSV download, and Apollo enrichment health/retry status.
- `/linkedin-templates`: editable static LinkedIn outreach templates by role.
- `/settings`: calling preferences, email templates, Gmail connection, and password changes.

## Data Flow

Pages use `apiFetch`, `apiUpload`, and `apiDownload` from `src/lib/api.ts`. Route components keep business rules light and defer persistence, filtering, scoring, enrichment, Gmail, and call state changes to backend endpoints.

## Testing Notes

Page tests live in `__tests__/components`. Shared mocks in `__tests__/setup.tsx` provide `next/navigation`, `AuthGuard`, `AppSidebar`, and API helpers; `AppShell` renders for real. When adding route behavior, prefer path-aware `apiFetch` mocks because many pages fetch multiple endpoints on mount. Because the mobile card list and the desktop table both exist in the DOM (CSS hides one per breakpoint, which jsdom does not apply), use `getAllBy*`/`queryAllBy*` for row content and query page titles via `getByRole("heading", ...)`.
