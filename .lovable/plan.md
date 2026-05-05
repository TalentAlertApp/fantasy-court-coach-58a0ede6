
## 1) Recompute Ballers.IQ on roster change
**File:** `src/pages/RosterPage.tsx`, `src/pages/ScoringPage.tsx`
- The `biqAdvisor` `useMemo` already depends on `[starters, bench, captainId]`, but those arrays are derived via `.map(resolvePlayer)` which produces new references even when content is identical, causing fine. The actual problem is **stale insights when roster mutates server-side** because `getBallersIQInsights` runs once and the page memoizes by reference. Add a stable signature: `JSON.stringify(roster.starters + roster.bench + captainId + roster.updated_at)` as the memo dependency. Same fix applied to `ScoringRecapBlock` (re-key by `selectedDay.day + total_fp + players signature`).
- Also drop the 24h `localStorage` cache in `TeamModal.TeamBallersIQ` when roster changes within the snapshot — already keyed by snapshot, no change needed (verify).

## 2) MY SQUAD page

### a) Lineup Advisor card layout (List view)
**File:** `src/components/ballers-iq/LineupAdvisorPanel.tsx`
- Restructure to **header on top** (wordmark + "LINEUP ADVISOR" label + summary line), and a 2-col grid of cards filling full width. Remove the left-side vertical wordmark column. Keep emblem watermark top-right.

### b) Card icons inside the 2 inner cards
**File:** `src/components/ballers-iq/BallersIQCard.tsx`
- Change top-left icon to always render `BallersIQBrand variant="emblem" forceTheme="light"` (no `transparent` flag — that emblem file is the requested asset).

### c) Header Ballers.IQ button = Wishlist size
**File:** `src/pages/RosterPage.tsx`
- Wishlist Button is `size="sm"` (h-9 with px-3). Replace the custom `<button>` (currently `h-9 px-3` already) with a `<Button size="sm" variant="outline">` wrapper so padding, border-radius (`rounded-xl`), and font sizing match exactly. Inner content stays as wordmark image.

### d) College column not truncating
**File:** `src/components/RosterListView.tsx` + `src/components/PlayerRow.tsx`
- Increase `<TableHead>` width for College from `w-32` to `w-44`.
- In `PlayerRow.tsx`, drop `truncate max-w-[8rem]` from the College cell, set `whitespace-nowrap`.

### e) "Swap Player" → "Quick Trade" + enforce 2-per-GW + premium header + jump to /transactions
**Files:** `src/pages/RosterPage.tsx`, `src/components/PlayerPickerDialog.tsx`
- Rename title prop passed in `RosterPage` from `"Swap Player"` to `"Quick Trade"`.
- **Enforcement**: before opening the picker for a swap (in `handleSwapRequest`) and before submitting `handleSwapSelect`, check `roster.free_transfers_remaining`. If `<= 0`, toast "GW transfer cap reached (2/2). Use Wildcard or wait until next GW." and abort. (`roster-current` already returns this from the server.)
- **Premium header in `PlayerPickerDialog`**: when `title === "Quick Trade"`, render a gradient header bar (matches `TeamModal` header style: `bg-gradient-to-br from-primary/15 via-primary/5 to-transparent`, larger title, FC/BC pill of swap player), and add a right-aligned action button **"Open in Trade Center"** that navigates via `useNavigate()` to `/transactions` (closes the dialog first).

### f) DOB (Age) on one line
**File:** `src/components/PlayerRow.tsx`
- Replace the two stacked `<span>`s with one inline: `{dobLabel} ({core.age || "—"})`. Keep `tabular-nums` and current font.

### g) Unify table value typography
**File:** `src/components/PlayerRow.tsx`
- All numeric/text cells should use the same classes as the College cell: `text-xs text-muted-foreground` (currently mix of `text-sm font-mono`). Apply to Salary, FP5, Value5, Last FP, Total FP, MPG, etc. Total FP keeps `font-bold text-foreground`. Photo and Player name unchanged.

## 3) /scoring

### a) Recap button uses dark transparent wordmark in dark theme
**File:** `src/pages/ScoringPage.tsx` (search for `FP TIMELINE` recap toggle button)
- Replace the existing wordmark image inside the toggle button with theme-aware variants:
  - light: `wordmark-light.png` (current default works)
  - dark: `wordmark-dark-transparent.png` via `<BallersIQBrand variant="wordmark" forceTheme="dark" transparent />`.

### b) Recap card icons + watermark
**File:** `src/components/ballers-iq/BallersIQCard.tsx` (already changed in step 2b → covers icon)
**File:** `src/components/ballers-iq/BallersIQRecapBlock.tsx`
- Add a far-right oversized rotated wordmark watermark to **each** of the 3 inner `<BallersIQCard>` instances. Approach: wrap each card and absolutely position a `<BallersIQBrand variant="wordmark" forceTheme>` image — light theme uses `wordmark-light` (non-transparent) and dark uses `wordmark-dark-transparent`. Style: `absolute -right-6 top-1/2 -translate-y-1/2 h-16 opacity-10 rotate-12 pointer-events-none`. Easier: add the watermark directly inside `BallersIQCard.tsx` so all 3 get it (ok since cards have `overflow-hidden`).

## 4) Team modal

### a) Bigger Ballers.IQ tab image
**File:** `src/components/TeamModal.tsx` (TabsTrigger for "biq")
- Change wordmark height from `!h-4` to `!h-5` (matches font height of "Played (81)" tab labels).

### b) Wire standout player photos+name → PlayerModal
**File:** `src/components/TeamModal.tsx` (`TeamBallersIQ` section)
- Pull `player_id` of FC/BC stars (`fcStar.id`, `bcStar.id`). Make the standout card a `<button>` that calls `setSelectedPlayerId(s.id)` (need to lift the setter in via prop or expose). Currently `selectedPlayerId` lives in parent `TeamModal` component — pass `onPlayerClick={(id) => setSelectedPlayerId(id)}` into `TeamBallersIQ`.

### c) NBA logo watermark on the BIQ tab
**File:** `src/components/TeamModal.tsx`
- Inside `TeamBallersIQ`, add absolutely-positioned `<img src={nbaLogo}>` (import from `@/assets/nba-logo.svg`) at top-right, `h-20 opacity-10 pointer-events-none`, similar to PlayerModal pattern.

## 5) Player Comparison modal

### a) Bottom Ballers.IQ assessment card
**File:** `src/components/PlayerCompareModal.tsx`
- Increase `DialogContent` from `max-w-lg` / `max-h-[85vh]` to `max-w-xl` / `max-h-[92vh]` and add a `min-h` so all content shows without inner scroll.
- After the stats rows, render a new card when both players exist:
  - Header: `BallersIQBrand emblem` + "BALLERS.IQ TAKE" label + premium gradient (`from-amber-400/10 via-card to-card border border-amber-400/30`).
  - Far-right wordmark watermark (light theme = `wordmark-light`, dark = `wordmark-dark-transparent`), oversized + rotated like team modal.
  - Centered NBA logo watermark behind text (`opacity-5 h-32`).
  - Body: 3 deterministic assessments + 1 conclusion, computed from the existing `stats` array:
    1. Production: compare FP/G & PTS — name the leader.
    2. Efficiency: compare Value (FP per $).
    3. Floor/Ceiling: compare Δ FP (form trend) and STL+BLK.
    - Conclusion: "Pick **X** for [reason] — but **Y** wins on [metric]."
- Pure utility added inline (no new file needed), guards against `b == null`.

### b) Premium header style on PlayerCompareModal
- Replace `DialogHeader` with a gradient header matching `TeamModal`/`PlayerModal`: `bg-gradient-to-br from-primary/15 via-primary/5 to-transparent`, oversized blurred NBA logo watermark behind the title.

### c) Search-result row: remove inline team badge, add team badge as top-right watermark
**File:** `src/components/PlayerCompareModal.tsx`
- Remove the inline `{logo && <img />}` chip in the result button row.
- Make each result row `relative overflow-hidden`, append an absolute team-badge watermark top-right (`h-10 opacity-15 group-hover:opacity-30 -mr-1 transition-opacity`), mirroring the team-modal header watermark style.

## 6) /teams

### a) Team name in primary color, bold
**File:** `src/pages/TeamsPage.tsx`
- Team name `<p>` (currently `text-[10px] text-muted-foreground`): change to `style={{ color: t.primaryColor }} className="text-[10px] font-bold"`.

### b) Standings tab: add Ballers.IQ insights card, compress League standings
**Files:** `src/pages/TeamsPage.tsx`, `src/components/standings/StandingsPanel.tsx` (or wrap at page level)
- At the bottom of the Standings tab, add a new BIQ card with 3 inner sub-cards:
  1. **Outstanding teams** — top 3 by win-pct from `standings`.
  2. **Watch list** — teams with **0** players on the user's current roster (use `useRosterQuery` + roster `team` tricodes).
  3. **Hidden gems** — top FP players whose NBA team is below median win-pct (query `players` aggregated FP, filter team-rank > 15).
- Each sub-card uses `BallersIQCard` styling (emblem icon top-left + wordmark watermark right per step 3b).
- **Layout & sizing**: wrap Standings tab content in a flex column with `h-[calc(100vh-220px)]`. The standings list area becomes a scrollable region (`flex-1 overflow-auto`); the Ballers.IQ card is fixed at the bottom. The card's bottom edge aligns with the page's left sidebar bottom (already covered by the viewport-height container).
- Card vertical height kept minimal: 3 sub-cards in a single row (`grid-cols-3`), each ~110px tall.

## Technical notes

- `roster.free_transfers_remaining` is already on the contract (returned by `roster-current` and `transactions-commit`) — no schema change.
- The `Quick Trade` swap path still uses `saveRoster` (not `transactions-commit`), so transfer counter enforcement is **client-side guard only** until `RosterPage` is migrated to `transactions-commit`. We add the client guard now to match UX expectations; server enforcement on `saveRoster` is a separate change (out of scope here).
- All new asset paths reuse existing `public/brand/` files; no new uploads required.
- No DB migration; no edge-function deploy.
