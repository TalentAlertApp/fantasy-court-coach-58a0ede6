## 1) /transactions — Trade Report Modal (`TradeReport.tsx`)

**a) Per-game metrics instead of L5 sums.**
Replace the current sum-of-L5 rows with per-game averages over the active roster (sum / 5 for L5 stats):
- Sum FP5 → **Avg FP / Game** (sum_fp5 / 5)
- Sum Stocks5 → **Avg Stocks / Game**
- Sum PTS5/REB5/AST5/MPG5 → **Avg PTS / Avg REB / Avg AST / Avg MPG**
- Keep "Salary used", "Bank", "Teams used" unchanged.

**b) Hover info.**
Wrap the "Metric" label cells with shadcn `Tooltip` so hovering "BIQ" or "FP" shows a 2-line definition. Also add tooltips on the new chip header in the player cards (we will add a BIQ chip — see §2).

---

## 2) BIQ — what it is, where it lives, plus a new Game Difficulty index

### What "BIQ" means in this codebase
**Ballers.IQ (BIQ)** is the project's proprietary intelligence layer (`src/lib/ballers-iq/*`). It produces:
- **Player Rating (0–100)** — composite of FP5, season FP, minutes stability, value5, stocks5, schedule adjustment (`calibration.ts → BIQ_WEIGHTS.rating`).
- **Captain Score** — fp5 + ceiling + minutes + matchup.
- **Risk** — High / Medium / Low based on injury, minutes drops, no-game risk.
- **Team Difficulty (0–100)** — already exists in `teamDifficulty.ts`; produces label `Easy | Neutral | Tough | Elite | Trap Spot` from win rate, point diff, points allowed, FP allowed.

### Where BIQ is currently shown
- `BallersIQPanel`, `BallersIQRecapBlock`, `BallersIQGameNightSummary`, `BallersIQLineupStrip`, `BallersIQMarketWatch`, `BallersIQPlayerVerdict`, `BallersIQTicker`, `LineupAdvisorPanel`, share cards, `PlayerModal` (Explain tab), `AICoachModal`, `ScoringPage` recap.

### Other useful surfaces (recommended additions)
- **Trade Report**: per-player BIQ rating chip + roster ΔBIQ row (avg rating before/after). *Implement now in §1 metrics list.*
- **Roster sidebar / RosterCourtView**: tiny rating dot on each player tile.
- **Players table**: optional column "BIQ".
- **Schedule list/grid**: per-game difficulty halo (see below).

### NEW: Game Difficulty on /roster
Add a per-player **next-opponent difficulty ring** around the team-badge avatar in `RosterCourtView` (and `RosterListView`).

Mechanics:
- For every roster player, look up next scheduled game from `useUpcomingByTeam` → opponent tricode.
- Run `calculateTeamDifficulty(opponent, scheduleGames)` (already exported) → returns score + label.
- Map label → ring color:
  - `Elite` → red `hsl(0 84% 60%)`
  - `Tough` / `Trap Spot` → orange `hsl(25 95% 55%)`
  - `Neutral` → blue `hsl(220 90% 60%)`
  - `Easy` → green `hsl(142 76% 45%)`
- Render a 2px ring + soft outer glow on the opponent badge circle. Tooltip on hover: `Next: vs/@OPP · Tough (72)`.

No new edge function — pure client computation, reuses existing `useScheduleQuery`.

---

## 3) Share Card — player photo modal + PNG (final fix)

The previous attempts kept fighting CORS proxies. Drop the in-component fetch chain entirely and use a **same-origin Supabase Edge Function** that proxies the NBA CDN image and returns it as `image/png` with permissive CORS. This eliminates the taint and 404-fallback chain.

**a) New edge function `supabase/functions/image-proxy/index.ts`**
- GET `?url=<nba-cdn-url>` → fetch upstream → return body with `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=86400`, `Content-Type: image/png`.
- Validate host: only allow `cdn.nba.com`, `ak-static.cms.nba.com`, `nba.com`.

**b) `BallersIQShareCard.tsx`**
- Replace the multi-proxy `useEffect` with a single src:
  `const proxied = ctx.imageUrl ? \`${SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(ctx.imageUrl)}\` : null;`
- Render `<img src={proxied} crossOrigin="anonymous" onLoad={() => setReady(true)} onError={() => setReady(true)}>`.
- `data-photo-ready` flips on first `onLoad` or `onError` (so export never blocks indefinitely).
- Keep initials only as `onError` fallback.

**c) `BallersIQShareCardModal.tsx`**
- Continue polling `data-photo-ready`, but lower attempts to 15.
- Switch html-to-image call to `toPng({ cacheBust: true, skipFonts: false, pixelRatio: 2 })`. No more JPEG fallback needed since the image is now same-origin.

**d) Test (`ballers-iq-share-card.test.tsx`)**
- Assert `<img>` `src` starts with `…/functions/v1/image-proxy?url=`.
- Assert `crossOrigin="anonymous"`.

---

## 4) /advanced — Share Search URL fix

Symptom: the `nbaps=` hash URL produced by `buildShareUrl()` looks valid but isn't restoring state. Root cause: `readSearchFromUrl()` parses `window.location.hash` with `URLSearchParams`. When the URL is opened on `id-preview--…lovable.app`, the SPA serves on a different host than `getShareOrigin()` returns, so the link points to the canonical `hoopsfantasy.app` host and the user is testing a copy on a different domain → it actually does load on the canonical host correctly, but in preview the hash isn't preserved.

**Fix:** make `getShareOrigin()` use `window.location.origin` whenever a window exists (drop the host whitelist). Shared links will then open on whatever domain the user is currently on, which is what they expect during testing AND in production. Keep `PUBLIC_ORIGIN` only as the SSR fallback.

Also harden `readSearchFromUrl`:
- Trim leading `#` and any leading `/` before `URLSearchParams`.
- If `URLSearchParams` returns null, manual split on `nbaps=` and read everything until next `&` or end.

Add a regression unit test `src/test/advanced-share-url.test.ts` round-tripping `buildShareUrl` ↔ `readSearchFromUrl`.

**5) Action Types dropdown bottom cut-off (already partly fixed, verify)** — confirm the popover uses `max-h-[60vh] overflow-y-auto` and that `Ejection` is reachable; if any wrapper still clips, switch to `max-h-[70vh]`.

---

## 5) /scoring — FP Timeline roster player dropdown

Above the chart header (next to the Ballers.IQ toggle), add a **multi-select roster picker**:

- Source: current team roster via `useRosterQuery` (already used on the page) — up to 10 players.
- UI: shadcn `Popover` + `Command` multiselect. Trigger shows count ("3 players").
- Each row (both list and selected chips) renders the **PlayerCardChip** (new small component):
  - Player photo (40×40 rounded).
  - Player name (bold) + position (`p.core.fc_bc`).
  - Average FP with color grade: green ≥30, yellow 20–30, orange 10–20, red <10.
  - Team badge as **watermark** on the far right with the same effect as `TeamModal` header (oversized, rotated 12°, opacity 0.18, absolute right, `pointer-events-none`). Reuse the exact pattern already used in `TradeReport.PlayerCard` (`-top-6 -right-6 h-32 w-32 rotate-12 opacity-[0.18]`).
- Selected players overlay extra lines on the existing recharts `LineChart` (one Line per player, distinct color) so user can compare individual contributions vs team total.

---

## 6) Team Comparison feature (PREMIUM)

### New modal: `src/components/TeamCompareModal.tsx`
Props: `{ teamA: string; teamB: string; open; onOpenChange }`.

Layout (1100px wide, dark luxe):
- **Header strip**: large team A badge ← VS → team B badge, with each team's `name`, conference, and league rank.
- **Section: Standings context** — League rank + Conference rank for each (from `useLeagueStandings` / `useNBAStandings`). Pills color-coded (top-third green, middle yellow, bottom red).
- **Section: Side-by-side metrics table** — columns: Metric · Team A · Team B · Edge. Rows: W-L, PPG, OPP PPG, Point Diff, FG%, 3P%, Pace (where available), BIQ Team Difficulty score+label. Color grade per row using a green/red diverging scale.
- **Section: Head-to-Head this season** — query `schedule_games` for `(home,away) IN ((A,B),(B,A))` AND `status='FINAL'`. List each game card (date, score, result tag) wired to `GameDetailModal` on click.

Premium polish: gradient bg `radial-gradient(circle at 20% 10%, hsl(45 90% 45% / 0.18) …)` matching share card; oversized rotated team badge watermarks behind each column; subtle ring + 20px-blur shadow.

### New shared component: `TeamCompareTrigger.tsx`
A small icon button (lucide `Swords` or `GitCompare`) with a tooltip "Compare teams". Variants: `ghost-icon` (24×24) and `inline` (with label).

### Insertion points
- **TeamModal header (`TeamModal.tsx`)** — far right of the title row. Pre-fills team A = current; opens a quick "vs ?" picker (small popover listing all 30 NBA teams).
- **/schedule list view (`ScheduleList.tsx`)** — game card, far right, immediately after Venue. `teamA = away`, `teamB = home`.
- **/schedule grid view (`ScheduleGridPage.tsx`)** — inline, **before** the Game Recap icon (played) or Box Score icon (scheduled).

### Data
- Standings: existing `useLeagueStandings` + `useNBAStandings`.
- H2H: client-side filter on `schedule_games` query already cached by `useScheduleQuery`.
- Per-team aggregates: derive from `schedule_games` (sum PPG, opp PPG over FINAL games).
- BIQ difficulty: reuse `calculateTeamDifficulty`.

No DB migrations, no new edge functions.

---

## File list

**Edited**
- `src/components/transactions/TradeReport.tsx` (per-game metrics, tooltips)
- `src/components/ballers-iq/share/BallersIQShareCard.tsx` (single proxy URL)
- `src/components/ballers-iq/share/BallersIQShareCardModal.tsx` (toPng options)
- `src/test/ballers-iq-share-card.test.tsx`
- `src/pages/AdvancedPage.tsx` (`getShareOrigin`, `readSearchFromUrl` hardening)
- `src/pages/ScoringPage.tsx` (roster dropdown + extra Lines)
- `src/components/RosterCourtView.tsx`, `src/components/RosterListView.tsx` (difficulty rings)
- `src/components/TeamModal.tsx` (compare icon)
- `src/components/ScheduleList.tsx`, `src/pages/ScheduleGridPage.tsx` (compare icons)

**Created**
- `supabase/functions/image-proxy/index.ts`
- `src/components/TeamCompareModal.tsx`
- `src/components/TeamCompareTrigger.tsx`
- `src/components/scoring/RosterPlayerPicker.tsx` + `PlayerCardChip.tsx`
- `src/lib/ballers-iq/difficultyColor.ts` (label → ring color)
- `src/test/advanced-share-url.test.ts`
