

## Plan: 6 fixes across header, roster, advanced, standings, scoring, AI search

### 1. Visible team indicator + quick switcher in page header
- Create a small `HeaderTeamPill` component that shows the active team name and renders an inline dropdown to switch teams (reusing `useTeam()`). It will also include a "Manage" affordance that opens the existing rename/delete dialogs.
- Mount it inside `AppLayout` at the top-right of the main content area (sticky strip above `<Outlet />`) so it appears on every page, not only the sidebar.
- Keep the existing sidebar `TeamSwitcher` for full CRUD, but the header pill becomes the always-visible source of truth.

### 2. Clear empty-state on Roster page with auto-pick CTA
- In `src/pages/RosterPage.tsx`, after roster + players load, detect when the selected team has zero rostered player ids (`rosterPlayerIds.length === 0`).
- Render a centered empty-state card: NBA logo, headline ("No players on {teamName} yet"), subline explaining the 10-player / $100M / 5FC-5BC rules, and two CTAs:
  - **Auto-Pick Roster** — calls the existing `roster-auto-pick` edge function for the selected team, then invalidates `roster-current`.
  - **Add Players Manually** — opens the existing `PlayerPickerDialog`.
- Hide the toolbar / chips / court while in this state to remove the "broken" look.

### 3. Fix `/advanced` (Playing Time Trends showing nothing)
- Root cause: `usePlayingTimeTrends` builds the 7-day window from `new Date()` (today = 2026-04-20), but the latest `player_game_logs.game_date` is 2026-04-10. The cutoff (2026-04-13) excludes every real game, so both tables end up empty.
- Fix: compute the cutoff from the **latest game_date in the dataset** (rolling 7-day window ending on the last played day), not from the wall clock. Fall back to "today" only if no logs exist.
- Also raise the "min season GP" filter slightly (≥3 instead of ≥2) so the lists don't fill with one-off appearances now that the window is correct.
- Update header label from "Last 7 Days" to "Last 7 Game Days (through {latestDate})" so the timeframe is unambiguous.

### 4. Standings opens on DIVISION by default
- In `src/components/standings/StandingsPanel.tsx`, change `useState<StandingsView>("league")` → `useState<StandingsView>("division")`.

### 5. Scoring "Weekly Breakdown" — show real player photo
- In `src/hooks/useScoringHistory.ts`, extend `ScoringWeek.best_player` / `worst_player` types to include `photo: string | null`.
- In `supabase/functions/scoring-history/index.ts`, when building `weekMap` best/worst objects (lines 165-170), include `photo: p.photo` (already available on each `players[]` row).
- In `src/pages/ScoringPage.tsx`, replace `<PlayerPhoto photo={null} ... />` with `<PlayerPhoto photo={w.best_player.photo} ... />` and the same for worst.

### 6. AI Coach "Explain" — fix autocomplete on `/`
- In `src/components/AICoachModal.tsx`:
  - Lower the autocomplete trigger from 3 chars to **1 char** so suggestions appear as the user types.
  - Increase `usePlayersQuery({ limit: 500 })` to `limit: 1000` so all 592 players are searchable.
  - Keep the diacritics-insensitive match (already correct via `normalize()`), and continue matching against name + tricode + full team name.
  - Allow pressing Enter to auto-select the top match if none is chosen yet, so the current "select from dropdown first" error stops blocking the user.

### Files touched
- `src/components/layout/AppLayout.tsx` — mount header pill
- `src/components/layout/HeaderTeamPill.tsx` — new component
- `src/pages/RosterPage.tsx` — empty-state + auto-pick CTA
- `src/hooks/usePlayingTimeTrends.ts` — rolling window from latest game_date
- `src/components/standings/StandingsPanel.tsx` — default tab "division"
- `src/hooks/useScoringHistory.ts` — type adds `photo`
- `supabase/functions/scoring-history/index.ts` — emit `photo` on best/worst
- `src/pages/ScoringPage.tsx` — render the photo
- `src/components/AICoachModal.tsx` — 1-char trigger, 1000-player fetch, Enter-to-pick

### Verification after implementation
- Header pill visible on every route; switching teams updates roster/scoring immediately.
- An empty team shows the new empty-state with a working "Auto-Pick Roster" button.
- `/advanced` lists increased/decreased players based on real recent game data.
- Visiting `/teams` lands on the **Division** tab.
- Scoring → Weekly Breakdown best/worst rows show actual player photos.
- AI Coach → Explain shows live suggestions starting at 1 character, including for players outside the original 500-row window (e.g. "Queta").

