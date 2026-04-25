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

### State

**Persisted (via `usePersistedState` / `sessionStorage`):**
- `contact`: The currently claimed contact (from `POST /calls/next`)
- `notes`, `calls`: Data for the current contact
- `outcome`: Selected call outcome
- `outcomeRequired`, `outcomeSaved`: Call-flow state — prevents navigating without recording an outcome
- `started`: Whether the user has started calling (past the filter screen)
- `filterCities`, `filterStates`, `filterCountries`, `filterBusinessHours`: Location filters
- `sessionHistory`: Previously viewed contacts (for back/forward navigation)
- `historyIndex`: Position in session history

**Transient:**
- `newNote`, `editingNote`, `editContent`: Note CRUD
- `smsDialogOpen`, `scheduledDate`: SMS dialog
- `callbackDate`: Per-contact callback date (ISO string, shown when outcome is `didnt_pick_up`)
- `retryDays`: Default retry interval from `GET /settings` — used to pre-fill `callbackDate`
- Twilio state: `twilioDevice`, `activeCall`, `callStatus`

### Pre-Start Screen

Location filters (country / state / city multi-selects from `GET /contacts/locations`), optional "business hours only" checkbox, then "Start Calling" button.

### Claiming the Next Lead

`claimNext` calls `POST /calls/next` with location query params. The response is a `Contact | null`; `null` means the queue is empty. Before claiming, the current contact is appended to `sessionHistory` for back/forward navigation.

### Settings Fetch

On mount, fetches `GET /settings` to obtain `retry_days` (default callback interval). This value is used to compute the default `callbackDate` when the user selects "Didn't Pick Up".

### Phone Numbers Section

Renders all non-null phone numbers (Mobile, Work, Corporate) with two buttons each:
- **Browser**: Initiates a WebRTC call via Twilio Client SDK
- **Phone**: Bridge call (placeholder)

Both set `outcomeRequired = true` so the user must record an outcome.

### Call Outcome Section

Four outcome buttons: "Didn't Pick Up", "Not Interested", "Interested", "Bad Number". First click selects, second click saves. Calls `POST /calls/log` with the contact ID, method, phone number, outcome, and optionally `callback_date`.

**Callback Date Picker:** When "Didn't Pick Up" is selected, a date input appears below the outcome buttons, pre-filled with `today + retry_days`. The user can edit this date to schedule a custom callback. The chosen date is sent as `callback_date` in the API request. After saving, the confirmed `retry_at` is displayed. On the scheduled date, the contact automatically re-enters the same caller's queue via the `claim_next_contact` RPC.

The same callback date picker also appears in the **Outcome Prompt Dialog** (modal that appears after a call ends via Twilio).

The response includes:
- `sms_prompt_needed`: If true, opens the SMS dialog
- `occasion_count` / `times_called`: Updates the contact's display counts
- `retry_at`: Confirmed callback date (displayed in the UI)

### Contact Card

Displays contact info, score, company description, and a "Callback" badge with the scheduled retry date when `retry_at` is set.

### Notes Section

Full CRUD:
- **Add**: Textarea + Plus button → `POST /contacts/{id}/notes`
- **Edit**: Pencil icon → inline textarea + Save button → `PATCH /notes/{id}`
- **Delete**: Trash icon → `DELETE /notes/{id}`

Notes are displayed newest-first with dates.

### SMS Dialog

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
- **Retry days**: Number input (1–90) — default number of days before a "didn't pick up" contact reappears in the same caller's queue. This is the default used when the caller does not specify a custom callback date in the call tracker.
- **SMS template**: Textarea with placeholder variables shown as badges: `<first_name>`, `<last_name>`, `<company_name>`, `<title>`, `<website>`

### Save

Calls `PUT /settings` with the current threshold, retry_days, and template values. Shows a green "Saved" confirmation for 3 seconds after success.

---

## email-tracking/page.tsx — Email Conversation Tracking

Monitors email conversations between the user and contacts they've called or emailed, using the Gmail API to detect replies.

### State

- `contacts`: Array of `TrackedContact` objects with sent/received counts and reply status
- `loading`, `syncing`: Loading states for initial fetch and manual sync
- `gmailConnected`: Whether the user's Gmail is linked (shows connect prompt if not)
- `selectedContactId`, `thread`, `threadLoading`: For the per-contact thread view

### Stats Bar

Four metric cards at the top: Contacts tracked, Emails sent, Emails received, Replies. Computed from the `contacts` array.

### Contact List

A table with columns: Contact (name + company + email), Sent count, Received count, Status, Last Activity. Each row is clickable.

Reply status is shown with color-coded indicators:
- Green dot / "Replied": contact has both sent and received emails
- Amber dot / "Awaiting reply": emails sent but no reply received
- Grey dot / "No emails": no emails exchanged yet

### Thread View

When a contact row is clicked, calls `GET /email/tracking/{contact_id}` and shows a chronological list of sent/received messages. Received emails have a green-tinted card; sent emails use the default card style. Each card shows direction icon, subject, from/to address, date, and a snippet preview.

### Sync

The "Sync Now" button calls `POST /email/tracking/sync` to pull the latest messages from Gmail for all interacted contacts. The sync also runs automatically when a call outcome is logged.

### Empty States

- **Gmail not connected**: Full-page prompt with link to Settings
- **No tracked conversations**: Explains that tracking starts when call outcomes are logged
