# Plan

## 1) `/schedule` — Tighten blurbs
**File:** `src/components/ScheduleList.tsx` (`GameCardBlurb`, ~L317)

- Remove the `Outstanding Players ·` / `Players to Watch ·` text label entirely. Keep only the colored icon (`Star` for played, `Eye` for scheduled).
- Drop the blurb text from `text-[14px] md:text-[15px]` → `text-[11px] md:text-[12px]`, keep italic + semibold + foreground color.
- Result: small icon + one-liner, no header label.

---

## 2) `/scoring` — New tab "Transactions Pulse"
**File:** `src/pages/ScoringPage.tsx`

Current tabs: **League** / **Your Team**. The user requested "FP Pipeline + Weekly Breakdown + new tab" — those two existing names live inside the **Your Team** view. We will:

- Add a third top-level tab next to League/Your Team: **Transactions Pulse** (`Repeat` icon).
- New component `TransactionsPulseView` rendering two side-by-side leaderboard tables:
  - **Most Picked Players** — `SELECT player_in_id, COUNT(*) FROM transactions WHERE player_in_id IS NOT NULL GROUP BY player_in_id ORDER BY count DESC LIMIT 20`, joined with `players` for name/team/photo/fc_bc.
  - **Most Waived Players** — same on `player_out_id`.
- Each row shows: rank · photo · FC/BC badge · name · team watermark · pick/drop count badge. Click name → `PlayerModal`, click watermark → `TeamModal` (reuses the existing modal state in `ScoringPage`).
- Data fetched via a new hook `useTransactionsPulse()` in `src/hooks/useTransactionsPulse.ts` (one Supabase RPC-less query each, `staleTime: 5 min`). Two `supabase.from('transactions').select(...)` calls aggregated client-side, then `players.select('id,name,team,photo,fc_bc').in('id', ids)`.
- Persist tab choice in the existing `nba_scoring_tab` localStorage key (extended union `"league" | "team" | "pulse"`).

---

## 3) `/advanced` — Redesign + new filters

### 3a) Leaderboards: 2-up rotating carousel
**Files:** `src/components/advanced/LeaderTable.tsx`, `AdvancedStatsTab.tsx`, `TrendingTab.tsx`.

Today each tab shows 3 cramped columns. Switch to a **2-card row** with a left/right rotating arrow on each card header that cycles through that card's pool of subjects. The two slots stay anchored in place so layout never reflows.

- **New primitive:** `<RotatingLeaderCard subjects=[{title, subtitle, icon, columns, rows}]>` — internal `useState` tracks the active subject; arrows on the header advance / wrap.
- Wider cards (each takes 50%) → name column gets ~2× the width → no more "Jericho…" truncation. Lift name to `text-sm`, allow up to ~22 chars before ellipsis. Stat pills shrink to `min-w-[40px]`.
- Card header layout: `[← prev] [icon · TITLE · subtitle] [next →] · [dot indicators]`.

**Advanced Stats tab — 4 subjects (2 visible, 2 reachable via arrows):**
1. Shooting Splits (existing) — FG% · 3P% · FT% · TS%
2. Glass & Hustle (existing) — OREB · DREB · TOT · STK/G · TOV
3. Impact (existing) — +/- · FP · V · MP
4. **NEW: Playmakers** — AST · TOV · AST/TO ratio · USG-proxy (FGA+FTA·0.44) · MP. Sorted by AST/TO desc with min 3 AST/g.

**Trending tab — 4 subjects:**
1. Hot Hands (existing) — FP5
2. Value Kings (existing) — V5
3. Stocks Surge (existing) — STK5
4. **NEW: Cold Snap** — Δ FP (most negative first) · FP5 · FP · MP5. Highlights bounce-back candidates; uses `computed.delta_fp` ascending.

Initial visible pair: slots `[1, 2]`; user rotates each independently.

### 3b) NBA Play Search — add `Ejection` action type
**File:** `src/pages/AdvancedPage.tsx` (`ACTION_TYPES`, ~L155)

Add `{ value: "ejection", label: "Ejection" }` to the array. No sub-filters apply to it (per the spec mapping).

### 3c) Conditional sub-filter UI (the big one)

All new controls live **below** the existing `[Player] [Action Type] [Open] [Clear]` row, inside the same NBA Play Search card. Render only when applicable.

**New file:** `src/components/advanced/PlaySubFilters.tsx` — owns all sub-filter state and emits a flat record up to `NBAPlaySearchSection`.

**New file:** `src/components/advanced/PlayCourtZones.tsx` — SVG overlay with 6 clickable polygon zones on top of `src/assets/court-bg.png`.

**New file:** `src/lib/play-filter-config.ts` — central data mapping (Qualifiers, Subtype, Areas, etc.) keyed by action type, exported as typed constants. Single source of truth so adding a new action later is a one-line change.

**Sub-filter sections (rendered conditionally per the mapping):**

| Control | Applies to | UI |
|---|---|---|
| Qualifiers (multi) | foul, 3pt, 2pt, freethrow | Checkbox chips. >5 → "Show more / Show less". |
| Subtype (multi) | foul, rebound, 3pt, 2pt, turnover, freethrow, jumpball | Checkbox chips. >5 → collapsible. |
| Shot Result (multi: Made/Missed) | 3pt, 2pt | 2 chips. |
| After Timeout (toggle "Yes") | foul, 3pt, 2pt, turnover | Single Switch. |
| Buzzer Beater (toggle "Yes") | 3pt, 2pt | Single Switch. |
| Area (court zones) | foul, rebound, 3pt, 2pt, turnover, block, steal | Visual court selector — see below. |
| Shot Distance | 3pt (21–71 ft), 2pt (0–24 ft) | Range slider + arc overlay. |

**Visual court selector (`PlayCourtZones`):**
- Half-court image: `src/assets/court-bg.png` (already in repo).
- Wrapper `<div className="relative aspect-[4/3] max-w-md">` with the image and an absolutely-positioned `<svg viewBox="0 0 400 300">` on top.
- 6 polygon paths sized to a half-court layout:
  - **Restricted Area** — small arc/circle directly under the rim.
  - **In The Paint (Non-RA)** — the painted key minus the RA.
  - **Mid-Range** — region inside the 3pt arc but outside the paint (single polygon covering both wings + top).
  - **Above the Break 3** — outside-arc cap above the paint.
  - **Left Corner 3** — outside-arc rectangle bottom-left.
  - **Right Corner 3** — outside-arc rectangle bottom-right.
- Each polygon: `fill="hsl(var(--nba-yellow))" fill-opacity={selected ? 0.45 : 0}`, `hover:fill-opacity-25`, `stroke="hsl(var(--nba-yellow))" stroke-opacity={selected ? 0.9 : 0.25}`, `cursor-pointer`. Click toggles. Multi-select.
- Selected zones echoed as removable chips below the court (for accessibility / clarity).

**Shot Distance overlay:**
- Min/max numeric inputs + `<Slider>` (Radix dual-thumb) labelled `"15 ft – 30 ft"`.
- Concentric arc bands rendered in the **same SVG**, layered *under* the area polygons:
  - Compute basket origin (top-center of viewBox) and draw arc bands every ~5 ft, full opacity inside [min, max], dimmed outside.
- Range bounds switch by action type: 2pt → 0–24 ft (default 0–24); 3pt → 21–71 ft (default 21–35).

**URL construction (`handleActionOpen`):**
Append all selected sub-filters as query params on `https://www.nbaplaydb.com/search`:
- `qualifiers`, `subtype`, `area`, `shotresult` → repeated params, one per value.
- `isaftertimeout=true`, `isbuzzerbeater=true` → only when on.
- `shotdistancemin`, `shotdistancemax` → numbers, only when range is narrower than the action's full bounds.

State stored as a single `subFilters` object inside `NBAPlaySearchSection`; reset whenever `actionTypes` changes (drop values that no longer apply per the mapping). Clear button also clears `subFilters`.

---

## Files touched

**Edited**
- `src/components/ScheduleList.tsx` — tighten `GameCardBlurb`.
- `src/pages/ScoringPage.tsx` — add Transactions Pulse tab + view component.
- `src/pages/AdvancedPage.tsx` — add `Ejection`, mount `<PlaySubFilters>`, rebuild URL.
- `src/components/advanced/AdvancedStatsTab.tsx` — switch to 2-up `RotatingLeaderCard`, add Playmakers subject.
- `src/components/advanced/TrendingTab.tsx` — switch to 2-up rotating, add Cold Snap subject.
- `src/components/advanced/LeaderTable.tsx` — widen name column, shrink stat pills slightly.

**Created**
- `src/components/advanced/RotatingLeaderCard.tsx`
- `src/components/advanced/PlaySubFilters.tsx`
- `src/components/advanced/PlayCourtZones.tsx`
- `src/lib/play-filter-config.ts`
- `src/hooks/useTransactionsPulse.ts`

No DB changes, no edge-function changes.

## Out of scope
- Persisting sub-filter selections across sessions.
- Mobile-specific layout for the SVG court (it scales responsively but is best on ≥sm screens).
- Changes to the `/scoring` League and Your Team views.
