# App Routes

This directory contains Next.js App Router pages. Authenticated pages share the same shell: `AuthGuard`, a full-height flex layout, `AppSidebar`, a scrollable `main`, and a thin primary gradient hairline.

## Route Map

- `/`: redirects to `/contacts`.
- `/login`: email/password login. Stores `access_token` and serialized `user` in `localStorage`.
- `/contacts`: paginated contact table with sorting and call outcome filters.
- `/contacts/[id]`: contact detail, notes, call history, and delete action.
- `/companies`: company directory with list and detail views.
- `/call-tracker`: filtered one-contact-at-a-time calling workflow with Twilio browser calls, outcomes, callback dates, notes, SMS/email prompts, session history, and claim timeout handling.
- `/scheduled-calls`: follow-up calls across users, with overdue/countdown badges and complete/cancel actions.
- `/todo-list`: standalone team to-do list. Sortable task table (Task, Assigned to, Assigned by, Due date) sorted with unfinished tasks first, then finished tasks, with each group ordered by closest due date (no-due-date tasks last). Tasks are grouped into three sections: **All** (literally everything — today, past, upcoming, and completed), **Today** (everything due today, completed or not), and **Past** (every completed task plus anything overdue from a past due date). Includes multi-assignee person pills, full-row navigation to details, subtle overdue highlighting, a per-person filter (available to everyone), and a create dialog (only the task name is required). The assigner and any assigned person can edit/reassign/mark done; delete remains assigner-only.
- `/todo-list/[id]`: task detail page showing the full description (hidden on the table) with multi-assignee edit controls, metadata cards, edit access for assignees, and assigner-only delete actions.
- `/email-tracking`: Gmail conversation tracking for sent follow-ups and replies.
- `/productivity`: call outcomes, conversion flow, and team performance reporting.
- `/import`: Apollo CSV upload, import progress, filtered CSV download, and Apollo enrichment health/retry status.
- `/linkedin-templates`: editable static LinkedIn outreach templates by role.
- `/settings`: calling preferences, SMS/email templates, Gmail connection, and password changes.

## Data Flow

Pages use `apiFetch`, `apiUpload`, and `apiDownload` from `src/lib/api.ts`. Route components keep business rules light and defer persistence, filtering, scoring, enrichment, Gmail, and call state changes to backend endpoints.

## Testing Notes

Page tests live in `__tests__/components`. Shared mocks in `__tests__/setup.tsx` provide `next/navigation`, `AuthGuard`, `AppSidebar`, and API helpers. When adding route behavior, prefer path-aware `apiFetch` mocks because many pages fetch multiple endpoints on mount.
