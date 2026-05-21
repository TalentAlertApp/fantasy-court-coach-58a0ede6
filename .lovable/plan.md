# Onboarding & post-login fixes

## A) Choose Your League step — visual + multi-select

**File:** `src/components/onboarding/ChooseLeagueStep.tsx`

1. **Replace Trophy icon with league logo.**
   - Import `nbaLogo` from `@/assets/nba-logo.svg` and `wnbaLogo` from `@/assets/wnba-logo.png`.
   - In `LeagueCard`, drop the rounded container; render a bare `<img>` (h-10 w-10, object-contain) using `lockedSport === "wnba" ? wnbaLogo : nbaLogo`.
   - Add hover "surge": `transition-transform group-hover:scale-110 group-hover:drop-shadow-[0_0_20px_hsl(var(--accent)/0.6)]`, and make the parent button a `group`.

2. **Allow selecting one or more leagues.**
   - Change `selectedId: string` → `selectedIds: Set<string>`, initialized with `[mainId]`.
   - Each `LeagueCard` becomes a checkbox-toggle. Main league card is always selected (cannot be unchecked) — keep it visually active but non-toggleable (or just enforce in the toggle handler).
   - Show an `active` ring and a small check badge in the top-right of the card when included.
   - `handleNext`: pick the **primary** league (main if included, else the first one) and pass `fantasyLeagueId: primaryId` plus a new `extraLeagueIds: string[]` (the rest).
   - Update `Props.onSubmit` signature: `(args: { fantasyLeagueId: string; extraLeagueIds: string[]; leagueCode })`.

3. **Top-right league watermark.**
   - Inside the page root (the `relative flex flex-col h-screen…` container), add an absolutely-positioned `<img>` aria-hidden of the locked league logo: `absolute top-0 right-0 h-[28rem] w-[28rem] object-contain opacity-[0.06] blur-[1px] pointer-events-none rotate-6 -translate-y-12 translate-x-12`. Behind content (`z-0`); main content stays `relative z-10`.

**File:** `src/pages/OnboardingPage.tsx`

4. Extend `handleLeagueSubmit` to accept `extraLeagueIds`. After `submitTeam` resolves, iterate the extras and call `supabase.functions.invoke("leagues-manage/attach-team", { body: { league_id, team_id } })` for each. Show one toast on success summarising count; non-fatal on per-league failures (toast warning, continue). Invalidate `["fantasy-leagues"]` once at the end.

## B) Post sign-out + sign-in routes to team picker, not "Draft Your Squad"

**Root cause:** `sessionStorage` flags `nba_team_picked_this_session` and `nba_welcome_back_seen` are NOT cleared on sign-out. When a user signs out and signs back in inside the same tab, `isTeamPickedThisSession()` returns `true`, so `RequireAuth` skips the redirect to `/welcome/pick-team`, leaving them on `/` (and any onboarding flicker shows the Hero "Draft Your Squad").

**Fix — `src/contexts/AuthContext.tsx`:** in `signOut()`, also call `clearTeamPickedThisSession()` and clear `SESSION_SEEN_KEY` (add a `clearWelcomeBackSeenThisSession()` helper in `welcome-back-store.ts` and call it). After this, on next sign-in `RequireAuth` will correctly route any user with ≥1 owned team to `/welcome/pick-team`.

**File:** `src/lib/welcome-back-store.ts` — add the `clearWelcomeBackSeenThisSession` export.

## C) "STEP 2 OF 3" label — middle "2" hidden by indicator dot

**File:** `src/components/onboarding/NameStep.tsx`

The absolutely-positioned `StepIndicator` (3 dots) sits at `top-8` and visually overlaps the centered "Step 2 of 3" text below it (the middle dot lands on the "2"). The duplicate is redundant.

Fix: remove the inline `<p>Step 2 of 3</p>` line above the heading (the dot indicator already conveys progress). Same review for `ChooseLeagueStep` and `DraftStep` if they reuse the pattern — keep visuals consistent (single indicator only).

## Technical notes

- `leagues-manage/attach-team` already exists and is used by `LeaguesPage`; reuse its `{ league_id, team_id }` body shape.
- No DB migrations, no edge function changes.
- Files touched: `ChooseLeagueStep.tsx`, `OnboardingPage.tsx`, `NameStep.tsx`, `AuthContext.tsx`, `welcome-back-store.ts`.
