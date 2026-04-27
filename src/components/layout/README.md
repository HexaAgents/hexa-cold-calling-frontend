# Layout Components and Shared Libraries

This directory contains the three layout components that wrap every authenticated page, plus documentation for the shared libraries in `src/lib/` and `src/types/`.

---

## app-sidebar.tsx — Navigation Sidebar

A 248px dark sidebar matching the Hexa platform demo's exact styling. Rendered on every authenticated page.

### Structure

```
<aside> (248px, side-pane-dark class)
  ├─ HexaLogo (top-left)
  ├─ <nav> (4 nav items, flex-1 scrollable)
  ├─ Sign out button
  └─ User card (avatar + name + email + online dot)
```

### Nav Items (lines 19–27)

Seven items defined as a static array: Contacts (`/contacts`), Companies (`/companies`), Call Tracker (`/call-tracker`), Email Tracking (`/email-tracking`), Productivity (`/productivity`), Import (`/import`), Settings (`/settings`). Each has a name, Lucide icon, and href.

### `isActive(href)` (lines 35–38)

Determines if a nav item should be highlighted. The Contacts item is active for both `/` and any path starting with `/contacts` (including `/contacts/[id]`). All other items use a simple `pathname.startsWith(href)` check.

### Active State Styling (lines 70–80)

Active items get:
- `bg-white/15 text-white` background
- A 2px wide, 18px tall primary-colored bar on the left edge (absolutely positioned)
- Icon stroke width increases from 1.7 to 2 for visual weight

Inactive items: `text-white/75` with `hover:bg-white/10 hover:text-white` transitions.

### `handleLogout()` (lines 40–43)

Clears `access_token` and `user` from localStorage, then navigates to `/login`. No API call — the JWT simply expires on its own; removing it from storage is sufficient to log out on the client side.

### User Card (lines 93–108)

Bottom of the sidebar. Shows:
- Avatar with initials (extracted from `full_name` — splits on spaces, takes first letter of each word, uppercased, max 2 chars)
- Full name (truncated with ellipsis if too long)
- Email (truncated)
- Green emerald dot indicating online status

The avatar uses shadcn's `Avatar`/`AvatarFallback` with `bg-primary` background.

---

## auth-guard.tsx — Authentication Wrapper

A render-prop component that protects authenticated pages.

### Pattern

```tsx
<AuthGuard>
  {(user) => <div>...page content using {user}...</div>}
</AuthGuard>
```

The `children` prop is a function that receives a `User` object. This pattern was chosen over a context provider because it makes the user object explicitly available at the call site — you can see exactly which pages have access to user data.

### Logic (lines 15–36)

1. **`useEffect`**: On mount (and pathname change), checks localStorage for `access_token` and `user`.
2. **No token**: Redirects to `/login` via `router.push()`.
3. **Token exists**: Parses the stored user JSON and sets state. If parsing fails (corrupted data), redirects to login.
4. **Loading state**: Shows a centered "Loading..." message while checking auth. Prevents the authenticated page from flashing before redirect.

### Why localStorage Instead of Supabase Session

The frontend never talks to Supabase directly for data operations (that's the backend's job). It only stores the JWT token for authenticating with the FastAPI backend. Using localStorage keeps the auth check synchronous and fast — no network round-trip on every page load.

---

## hexa-logo.tsx — Brand Logo Component

A reusable logo component matching the Hexa platform demo.

### Props

- `size` (default 32): Width and height of the logo container in pixels
- `showText` (default false): Whether to show "Hexa" text next to the icon
- `textClassName`: Additional CSS classes for the text (e.g., `"text-base text-white"` in the sidebar)

### Rendering

A rounded `bg-primary` square containing an "H" letter. The font size is `size * 0.4` — proportional to the container. When `showText` is true, "Hexa" appears to the right with `font-semibold tracking-tight`.

---

## src/lib/api.ts — Backend API Client

Two functions that handle all communication with the FastAPI backend.

### `apiFetch<T>(path, options) → Promise<T>`

For JSON requests (GET, POST, PATCH, PUT, DELETE):

1. **Line 1**: Reads `NEXT_PUBLIC_API_URL` from environment, falls back to `http://localhost:8000`.
2. **Lines 7–8**: Checks localStorage for the access token (only on client side — `typeof window !== "undefined"` guard for SSR safety).
3. **Lines 10–14**: Sets `Content-Type: application/json` and merges any additional headers from `options`. Adds `Authorization: Bearer {token}` if a token exists.
4. **Line 17**: Makes the fetch call to `{API_URL}{path}`.
5. **Lines 19–22**: If response is not OK, tries to parse the error body for a `detail` field (FastAPI's error format). Throws an Error with either the detail message or a generic status code message.
6. **Line 24**: Returns the parsed JSON response, typed as `T`.

### `apiUpload<T>(path, file) → Promise<T>`

For file uploads (specifically CSV import):

1. **Lines 31–32**: Creates a `FormData` object and appends the file.
2. **Lines 34–37**: Sets the Authorization header but does NOT set Content-Type — the browser automatically sets `multipart/form-data` with the correct boundary when using FormData.
3. **Lines 39–43**: Makes the POST request with the FormData body.
4. **Lines 45–48**: Same error handling as `apiFetch`.

### Why Two Functions

`apiFetch` sets `Content-Type: application/json`, which would break file uploads. `apiUpload` omits Content-Type to let the browser set the correct multipart boundary. Merging them into one function with conditionals would violate the Single Responsibility principle.

---

## src/lib/supabase.ts — Supabase Client

A single function `createClient()` that creates a Supabase browser client using `@supabase/ssr`. Currently used for potential future features (e.g., realtime subscriptions). Auth is handled through the backend API, not directly through Supabase from the frontend.

---

## src/lib/utils.ts — Utility Functions

A single function `cn()` that merges Tailwind CSS class names. Uses `clsx` for conditional classes and `tailwind-merge` to deduplicate conflicting Tailwind utilities. Standard pattern from shadcn/ui.

---

## src/types/index.ts — TypeScript Interfaces

Defines all data types used across the frontend. These mirror the backend's Pydantic schemas exactly:

- **`Contact`**: 30 fields matching `ContactOut` schema. All nullable fields use `string | null`.
- **`ContactListResponse`**: Wraps paginated contacts with `total`, `page`, `per_page`.
- **`CallLog`**: Single call log entry with `call_date`, `call_method`, `outcome`, `is_new_occasion`.
- **`CallLogResponse`**: Extended response from logging a call — includes `sms_prompt_needed` and `occasion_count`.
- **`Note`**: Single note with `content`, `note_date`, `created_at`, `updated_at`.
- **`Settings`**: Global settings with `sms_call_threshold` and `sms_template`.
- **`ImportBatch`**: Import progress with `total_rows`, `processed_rows`, `stored_rows`, `discarded_rows`, `status`.
- **`User`**: Authenticated user with `id`, `email`, `full_name`.

These types are imported by every page component to ensure type safety on all API responses.
