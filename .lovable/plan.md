

## Plan: Add login (Email/Password + Magic Link) with per-user team ownership

### Goals
- Gate the entire app behind sign-in.
- Support **Email + Password** and **Magic Link**.
- New teams created after login belong to the creator; existing teams stay visible to everyone (per your "Per-user from now on" choice).
- No profiles table — Supabase `auth.users` only.

### 1 · Database migration
- Add nullable `owner_id uuid` column to `public.teams` (FK → `auth.users(id) ON DELETE SET NULL`). Existing rows keep `owner_id = NULL` → treated as "shared/legacy".
- Replace permissive RLS on `public.teams` with:
  - SELECT: `owner_id IS NULL OR owner_id = auth.uid()`
  - INSERT: `auth.uid() IS NOT NULL` and `owner_id = auth.uid()`
  - UPDATE/DELETE: `owner_id = auth.uid()` (legacy NULL-owned teams remain read-only via UI, edited only through edge functions).
- Other 9 tables (roster, transactions, players, schedule_games, etc.) keep current RLS — they're keyed by `team_id` and remain reachable through edge functions (which use service role). This matches your "data stays shared, new teams per-user" choice.

### 2 · Supabase config (you do this in the dashboard)
- Authentication → URL Configuration → set **Site URL** to the preview URL and add the same as a Redirect URL (so magic links land back in-app).
- Authentication → Providers → Email: **enable**, with "Confirm email" turned **off** for friction-free signup (you can re-enable later).
- No Google setup needed — Magic Link covers passwordless without Google Cloud configuration.

### 3 · Frontend — auth surface

**New files**
- `src/contexts/AuthContext.tsx` — wraps the app; subscribes to `supabase.auth.onAuthStateChange` (set up BEFORE `getSession()` per Supabase contract); exposes `{ user, session, loading, signOut }`.
- `src/pages/AuthPage.tsx` — single page at `/auth` with two tabs:
  - **Sign in / Sign up** (Email + Password) — shared form, two buttons; signup uses `emailRedirectTo: window.location.origin`.
  - **Magic link** — email input → `signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })` → toast "Check your inbox".
  - Branded with the existing dark theme + NBA logo.
- `src/components/auth/RequireAuth.tsx` — guard wrapper. While loading, render a centered spinner. If no session, `<Navigate to="/auth" replace />`.

**Edits**
- `src/App.tsx` — wrap `<Routes>` so `/auth` is public and everything else (the entire `<AppLayout>` subtree) sits inside `<RequireAuth>`. Add `<AuthProvider>` above `<TeamProvider>`.
- `src/components/layout/AppLayout.tsx` (or the sidebar) — add a small user pill at the bottom showing the email + "Sign out" button calling `supabase.auth.signOut()` then `navigate("/auth")`.

### 4 · Frontend — wire the auth header to edge functions

Edge functions currently use `apikey` only. To carry the user identity to `teams` so it can stamp `owner_id`, update `src/lib/api.ts`:
- Read the current session via `supabase.auth.getSession()` inside `apiFetch` and add `Authorization: Bearer <access_token>` when present.
- Falls back gracefully (still sends `apikey`) so unauthenticated calls during boot don't crash.

### 5 · Edge function update — `supabase/functions/teams/index.ts`
- Read the JWT from `Authorization` header, decode `sub` (user id) using the supabase-js helper (`createClient(...).auth.getUser(jwt)`).
- On `POST` (create team): inject `owner_id: user.id`. If no user → 401.
- On `PATCH` / `DELETE`: verify the row's `owner_id` matches `user.id` (or is NULL → reject for safety). If no user → 401.
- On `GET`: filter by `owner_id IS NULL OR owner_id = user.id`. If no user → return empty list.

### 6 · TeamContext interplay
- `fetchTeams()` will now return only owned + legacy teams for the signed-in user. The existing auto-correct logic already picks the first populated team and persists to localStorage — works unchanged.
- When the user signs out, clear `localStorage["nba_selected_team_id"]` so the next user doesn't inherit a stale selection.

### Acceptance checklist
- Visiting `/` while signed out → redirected to `/auth`.
- Magic link tab → enter email → toast → click link in inbox → land on `/` signed in.
- Email+password signup → immediately signed in (since email confirm is off).
- Header shows the signed-in email + Sign out button.
- Creating a new team while signed in → team is created with `owner_id = your uid`. Signing out and signing up as a second user → second user does NOT see your new team, but DOES see the pre-existing legacy teams.
- Trying to rename/delete a team you don't own → fails with a toast (RLS rejects).

### Files touched
- New: `src/contexts/AuthContext.tsx`, `src/pages/AuthPage.tsx`, `src/components/auth/RequireAuth.tsx`
- Edited: `src/App.tsx`, `src/lib/api.ts`, `src/components/layout/AppLayout.tsx`, `supabase/functions/teams/index.ts`
- New migration: add `owner_id` column + new RLS policies on `public.teams`

