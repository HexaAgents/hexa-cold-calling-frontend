# App Pages — Frontend Routes

This directory contains all Next.js App Router pages. Each file under `app/` maps to a URL route. The frontend contains **zero business logic** — every user action results in an API call to the backend. The frontend is purely presentational.

## Architectural Pattern

Every authenticated page follows this exact structure:

```
AuthGuard wrapper
  └─ flex h-screen overflow-hidden
       ├─ AppSidebar (248px dark rail)
       └─ main (flex-1, scrollable)
            ├─ gradient hairline (h-px, primary gradient)
            └─ PageContent component
```

The `AuthGuard` component checks `localStorage` for a valid token and user JSON. If missing, it redirects to `/login`. If present, it passes the `User` object to its children via a render prop.

---

## layout.tsx — Root Layout

The root layout wraps every page. It:

1. **Lines 5–18**: Loads three Google fonts via `next/font/google`:
   - **Geist Sans** (`--font-geist-sans`): Primary UI font
   - **Geist Mono** (`--font-geist-mono`): Used for monospaced values like scores
   - **Playfair Display** (`--font-display`): Display/serif font matching the Hexa demo
2. **Lines 20–23**: Sets metadata (page title, description).
3. **Lines 33–34**: Applies all three font CSS variables plus `antialiased` to the `<body>`. The actual font rendering is controlled by `globals.css` via `@theme inline`.

---

## page.tsx — Root Redirect

A single line: `redirect("/contacts")`. The root URL `/` immediately redirects to the contacts page. No content is rendered.

---

## login/page.tsx — Authentication

The only page that does NOT use `AuthGuard` or `AppSidebar` (since the user isn't authenticated yet).

### State

- `email`, `password`: Form inputs
- `error`: Error message from failed login attempt
- `loading`: Disables the submit button during API call

### `handleSubmit` (lines 18–40)

1. Prevents default form submission.
2. Calls `POST /auth/login` with email and password via `apiFetch`.
3. On success: stores `access_token` and `user` JSON in `localStorage`, then navigates to `/contacts`.
4. On failure: displays the error message from the backend (e.g., "Invalid credentials").

### UI

Centered card with Hexa logo, email/password inputs, error display, and submit button. Uses shadcn `Button`, `Input`, and `Label` components.

---

## contacts/page.tsx — Contact List

The main dashboard showing all imported contacts in a sortable, filterable table.

### State

- `contacts`: Array of Contact objects for the current page
- `total`: Total count across all pages (for pagination)
- `page`, `sortBy`, `sortOrder`, `outcomeFilter`: Query parameters sent to the backend
- `loading`: Shows "Loading..." in the table body

### `fetchContacts` (lines 68–87)

Called on mount and whenever sort/filter/page changes (via `useCallback` + `useEffect`). Builds URLSearchParams and calls `GET /contacts?sort_by=...&sort_order=...&page=...&per_page=50&outcome_filter=...`.

### `toggleSort(column)` (lines 89–95)

Clicking a column header toggles sort direction. If clicking a different column, resets to ascending. Connected to the Score, Calls, and Status column headers via `ArrowUpDown` icons.

### `displayStatus(contact)` (lines 97–101)

Determines what to show in the Status column. Priority: messaging status ("To be messaged", "Message sent") over call outcome ("Didn't pick up", "Not interested", "Interested"). Falls back to "—" for contacts with no status.

### `statusVariant(contact)` (lines 103–110)

Maps status to shadcn Badge variants for color coding:
- `"default"` (primary color): "Message sent" or "Interested"
- `"secondary"`: "To be messaged"
- `"destructive"` (red): "Not interested"
- `"outline"` (neutral): No status or "Didn't pick up"

### Table

6 columns: Name (links to detail page), Title, Company, Score (monospace font), Calls (occasion count), Status (colored badge). Pagination controls appear when total > 50.

---

## contacts/[id]/page.tsx — Contact Detail

Full detail view for a single contact.

### Data Loading (lines 42–46)

On mount, fires three parallel API calls:
- `GET /contacts/{id}` → contact data
- `GET /contacts/{id}/notes` → notes list
- `GET /calls/contact/{id}` → call history

### `fields` Array (lines 62–75)

A list of `[label, value]` tuples that renders a 2-column grid. Only fields with non-null values are displayed. URL fields (Website, LinkedIn, Company LinkedIn) render as clickable links with `ExternalLink` icons.

### Delete (lines 48–55)

The `handleDelete` function shows a `confirm()` dialog, then calls `DELETE /contacts/{id}` and navigates back to the contacts list.

### Sections

Three sections below the contact info: Call History (date + method + outcome badge), Notes (date + content). Both show "No calls/notes yet" when empty. A `scoring_failed` badge appears if the contact's scoring errored.

---

## call-tracker/page.tsx — The Calling Interface

The most complex page. Shows one contact at a time with navigation, dialing, notes, and SMS.

### State (lines 66–78)

- `contacts`: Full list loaded on mount (up to 200, sorted by created_at asc)
- `index`: Current position in the list
- `notes`, `calls`: Data for the current contact
- `outcome`: Selected call outcome from the dropdown
- `newNote`, `editingNote`, `editContent`: Note creation/editing state
- `smsDialogOpen`, `scheduledDate`: SMS dialog state
- `outcomeRequired`: Set to true after a call button is clicked — prevents navigating to next contact without selecting an outcome

### Navigation (lines 257–274)

- **Previous**: Decrements `index` (disabled at 0)
- **Next**: Increments `index` (requires outcome if `outcomeRequired` is true). At the end of the list, shows "Import more" button linking to `/import`.

### Phone Numbers Section (lines 299–333)

Renders all non-null phone numbers (Mobile, Work, Corporate) with two buttons each:
- **Browser**: Initiates a WebRTC call via Twilio Client SDK (currently shows an alert placeholder)
- **Phone**: Initiates a bridge call (currently shows an alert placeholder)

Both set `outcomeRequired = true` so the user must record an outcome.

### Call Outcome Section (lines 336–354)

A required dropdown with three options. The "Save outcome" button calls `POST /calls/log` with the contact ID, method, phone number, and selected outcome. The response includes:
- `sms_prompt_needed`: If true, opens the SMS dialog
- `occasion_count`: Updates the contact's display count

### Notes Section (lines 357–408)

Full CRUD:
- **Add**: Textarea + Plus button → `POST /contacts/{id}/notes`
- **Edit**: Pencil icon → inline textarea + Save button → `PATCH /notes/{id}`
- **Delete**: Trash icon → `DELETE /notes/{id}`

Notes are displayed newest-first with dates.

### SMS Dialog (lines 420–456)

A modal dialog that appears when `sms_prompt_needed` is true. Two options:
- **Send now**: Calls `POST /sms/send` immediately
- **Schedule**: Pick a date/time, calls `POST /sms/schedule` with an ISO datetime

---

## import/page.tsx — CSV Upload

### Upload Flow

1. User drags a CSV file onto the drop zone (or clicks "Choose file")
2. `handleUpload()` validates it's a `.csv` file
3. Calls `apiUpload("/imports/upload", file)` which sends a multipart form
4. Backend returns a `batch_id` and starts background processing
5. Frontend creates a local `ImportBatch` object with `status: "processing"`
6. `useEffect` interval polls `GET /imports/{id}/status` every 2 seconds
7. Progress bar renders `processed_rows / total_rows` as a percentage
8. When status changes from "processing", the interval stops and recent batches refresh

### Recent Imports

On mount, fetches `GET /imports/recent` and displays the 10 most recent imports with their stored/discarded counts and status badges.

---

## settings/page.tsx — Global Configuration

### Data Loading

On mount, fetches `GET /settings` and populates the form fields.

### Form Fields

- **SMS threshold**: Number input (1–100) — how many call occasions before the SMS prompt appears
- **SMS template**: Textarea with placeholder variables shown as badges: `<first_name>`, `<last_name>`, `<company_name>`, `<title>`, `<website>`

### Save (lines 57–70)

Calls `PUT /settings` with the current threshold and template values. Shows a green "Saved" confirmation for 3 seconds after success.
