

## Five fixes for the Pick Player dropdown, Welcome Back recap, schedule preview & game cards

### 1. PICK PLAYER team dropdown — center watermark + tricode, narrower
File: `src/components/PlayerPickerDialog.tsx`

- Change grid template from `grid-cols-[1fr_110px]` → `grid-cols-[1fr_88px]` (matches the screenshot's tight ~80px width).
- `SelectTrigger`: drop padding from `px-2` → `px-1.5`, justify content centered (`justify-center` via shadcn — already inline-flex). When `teamFilter !== "ALL"`, render the small team logo + tricode inside the trigger (centered).
- `SelectItem` layout: switch from left-anchored `pl-8` + absolute watermark to **a centered flex container**:
  - Wrapper: `flex items-center justify-center gap-1.5 relative px-1`
  - Watermark: change positioning from `absolute -left-1` → in-flow `relative` `h-6 w-6` sitting just before the tricode (no longer absolute / overflowing).
  - Both watermark and tricode share the centered group, identical to the dropdown trigger row.
  - Keep the surge effect (`group-hover:scale-110`, `group-data-[highlighted]:opacity-90`) on the in-flow watermark.
  - Drop the `· {n}/2` count suffix to keep the row narrow; reveal the count instead as a tiny right-edge badge `text-[9px] tabular-nums text-muted-foreground` only when `> 0`.

### 2. Welcome Back — fix roster shape to actually render data
File: `src/components/welcome-back/WelcomeBackHero.tsx`

The contract `RosterCurrentPayloadSchema` returns `starters: number[]`, `bench: number[]`, `captain_id: number` — **not full player objects**. The current `topScorer` / `captain` lookup operates on `p.core?.name`, `p.last5?.fp5`, `p.is_captain` and silently produces nothing.

Fix:
- Add `usePlayersQuery({ limit: 250 })` so we have the full `PlayerListItem[]` (with `core.name`, `core.photo`, `last5.fp5`).
- Build `rosterIds = [...starters, ...bench]` from `rosterData.roster`.
- Resolve roster players: `players.filter(p => rosterIds.includes(p.core.id))`.
- `topScorer` = highest `last5.fp5` among resolved roster.
- `captain` = `players.find(p => p.core.id === rosterData.roster.captain_id)`.
- Graceful empty states already in place; ensure the cards also render fallback text when `rosterData` is loading or when `players` query is loading (skeleton-style "—").
- Guard against `null` captain_id (contract says it's required `IntSchema` but old saves may have 0; treat `0` / falsy as "no captain").

### 3. RequireAuth welcome-back gating — compile sanity check
File: `src/components/auth/RequireAuth.tsx`

Already compiles cleanly: `welcomeOpen`, `skipOnboardingGate`, `ready`, `shouldOnboard`, `user` are all defined and the conditional block only references defined state. **One minor improvement**: `useState` initializer reads `user?.id` but at first render `user` may still be `loading` — currently we early-return `<Loader2/>` before anything checks `welcomeOpen`. To avoid a race where `welcomeOpen=false` was computed pre-auth-resolution:

- Move `welcomeOpen` from `useState` initializer to a `useEffect` that runs once `loading === false && user?.id` is known, then sets state.
- Also: explicitly type the `Props` interface (`React.ReactNode` import is already present via JSX) — no change needed.

No other code changes required; document the audit in a brief inline comment.

### 4. SchedulePreviewPanel day-default — confirm + harden
File: `src/components/SchedulePreviewPanel.tsx`

Current logic uses `lastGwRef` + `snappedRef` and only re-snaps when `gwChanged || !snappedRef.current`. This already preserves manual day clicks. Two small hardenings:

- When the user clicks a day chip, mark `snappedRef.current = true` explicitly (defensive — already true at that point, but makes intent clear).
- Reset `snappedRef.current = false` if `daysWithGames` becomes empty then refills (e.g. switching across an empty GW). This guarantees the next non-empty week gets a fresh snap.
- No behavior change for the common case; confirms #4's intent.

### 5. SchedulePreview — enrich each game card with team form & standings
File: `src/components/SchedulePreviewPanel.tsx`

Each game row is currently a single 28px-tall line. Convert to a richer **two-line card** (kept compact, ~64px tall):

**Top line** (existing): away logo + tricode + `@` + home logo + tricode + tip-off time. Yellow highlights for roster-involved teams stay.

**Bottom line — split in two halves** (away on left, home on right, separated by the `@`):

For each side render three micro-stats, in the team's primary color tint:
1. **Last 5 result strip** — five colored squares (W=`bg-emerald-500/80`, L=`bg-red-500/80`), `h-2 w-2 rounded-sm`, ordered oldest → newest left to right.
2. **Overall record + pct** — `28-15 · .651` in `text-[10px] font-mono tabular-nums text-muted-foreground`.
3. **Venue split** — for the **away team** show their **away record** `Away 12-9`; for the **home team** show their **home record** `Home 18-5`. Same mono micro-text.
4. **Division position** — small chip `1st Atl` / `3rd Pac` (computed by sorting all teams within their division by pct), `text-[9px] uppercase tracking-wider text-foreground/60`, no border.

**Data sources**:
- Add a **new query** `useScheduleStandingsContext()` (defined locally inside the panel file or as a tiny new hook `src/hooks/useStandingsContext.ts`) that pulls all `schedule_games(home_team, away_team, home_pts, away_pts, status, tipoff_utc)` once with `staleTime: 5min`, then derives:
  - The existing `useNBAStandings` rows (records, home/away splits, division).
  - A `last5ByTeam: Record<string, ("W"|"L")[]>` map by sorting FINAL games per team by `tipoff_utc` desc, taking the 5 most recent results.
  - A `divisionRankByTeam: Record<string, { rank: number; divLabel: string }>` map by grouping standings by division, sorting by pct then `w-l`, then assigning ordinals (`1st`, `2nd`, …) and a 3-letter division label (`Atl`, `Cen`, `SE`, `NW`, `Pac`, `SW`).
- Pass the resolved per-team stats into each row at render time. If a team has zero finals (preseason / injury-skipped), render `—` placeholders.

**Layout polish**:
- Wrap each row in a `flex flex-col gap-1.5 px-2.5 py-2` card (was `h-7`); container `max-h-44` becomes `max-h-72` for breathing room.
- Top line keeps existing tricodes & yellow highlight.
- Bottom line uses `grid grid-cols-[1fr_auto_1fr] items-center gap-2` with the away cluster on the left, the `@`/time stamp center, and home cluster on the right (right-aligned).
- Last-5 strips are color-tinted with the team's accent (`style={{ color: NBA_TEAM_META[t]?.primaryColor }}`) for the chip background border to feel team-specific.

### Files touched
- `src/components/PlayerPickerDialog.tsx` — narrower dropdown, centered watermark + tricode (item 1).
- `src/components/welcome-back/WelcomeBackHero.tsx` — resolve roster IDs against `usePlayersQuery`, fix top-scorer / captain (item 2).
- `src/components/auth/RequireAuth.tsx` — defer `welcomeOpen` to `useEffect` after auth resolves; comment audit (item 3).
- `src/components/SchedulePreviewPanel.tsx` — defensive snap-ref handling + new enriched game card layout (items 4 & 5).
- `src/hooks/useStandingsContext.ts` — NEW. Pulls all schedule games once and exposes `{ standings, last5ByTeam, divisionRankByTeam }` (item 5).

### Outcome
- Dropdown is as narrow as possible with the watermark and 3-letter code stacked center, matching the screenshot.
- Welcome Back actually shows the user's top scorer + captain (it was silently empty before).
- Auth gating is race-safe: recap only computed after the user is loaded.
- Day chip selection persists across user clicks; only changing GW or first load auto-snaps.
- Every Schedule Preview matchup now reads like a sports-app card: form strip, record, home/away split, division rank — premium at a glance.

