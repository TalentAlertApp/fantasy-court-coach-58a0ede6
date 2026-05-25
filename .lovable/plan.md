## Goal

Gate the entire `/commissioner` page behind a password prompt. The password is stored as a Supabase secret (`COMMISSIONER_ACCESS_PASSWORD`) and validated server-side via a new edge function. Once a user enters it correctly, unlock is remembered per-user across logouts. The gated screen shows only the password input plus a watermark of the active team's league logo (NBA/WNBA/EuroLeague) in the top-right with a hover surge.

This is independent from and additive to the existing `x-admin-secret` (which still controls the destructive tools inside the page).

## What to build

### 1. New secret
- `COMMISSIONER_ACCESS_PASSWORD` — requested via `add_secret` (user sets the value). No default.

### 2. New edge function: `commissioner-access-verify`
- POST `{ password: string }`.
- Validates the caller's JWT via `getClaims()` (must be signed in).
- Constant-time compares `password` with `Deno.env.get('COMMISSIONER_ACCESS_PASSWORD')`.
- Returns `{ ok: true }` on success, 401 on mismatch, 500 if secret not configured.
- CORS headers on all responses. No DB writes.

### 3. New gate component: `src/components/commissioner/CommissionerAccessGate.tsx`
- Props: `{ children }`.
- Reads unlock flag from `localStorage` key `commissioner_unlocked:<userId>` (per-user). If present → renders `children` directly.
- Otherwise renders a centered minimal screen:
  - Password `<Input type="password">` + Unlock button + error message slot.
  - On submit → `supabase.functions.invoke('commissioner-access-verify', { body: { password } })`. On `ok:true`, set the localStorage flag and re-render to show the page; on error, show "Incorrect password".
  - Top-right league logo watermark (size ~140px, opacity ~25%, `pointer-events-auto` so hover works). Hover surge: scale 1.08 + opacity 0.55 with `transition-transform duration-300` — mirrors the existing NBA team hover surge pattern from `mem://features/nba-team-integration`.
- League logo source = current team's league: pick from `nbaLogoSrc | wnbaLogoSrc | euroleagueLogoSrc` based on `useTeam().currentTeam` sport (fallback NBA).

### 4. Wire into `CommissionerPage`
- Wrap the page's existing top-level return in `<CommissionerAccessGate>…</CommissionerAccessGate>`. No other behavior changes; the existing Admin Secret input continues to work as today.

## Persistence behavior
- Key is namespaced by `auth.user.id`, so logout/login as the same user keeps the unlock; a different user on the same browser gets their own gate. Clearing browser storage resets it (as expected for a localStorage gate).

## Security notes
- Password never ships in the bundle — only the edge function reads the secret.
- Gate is UX, not a hard authz boundary: the destructive endpoints are still protected by their existing `x-admin-secret` header. Anyone who already knows the admin secret could still call those functions directly with curl — that's unchanged.

## Files

- Add: `supabase/functions/commissioner-access-verify/index.ts`
- Add: `src/components/commissioner/CommissionerAccessGate.tsx`
- Edit: `src/pages/CommissionerPage.tsx` (wrap render with the gate)
- Secret: `COMMISSIONER_ACCESS_PASSWORD` (added via add_secret on build)
