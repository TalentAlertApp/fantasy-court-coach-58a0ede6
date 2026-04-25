
## Five fixes — Schedule CORS bug, sidebar polish, advanced stats import + UI, premium Player Modal header

---

### 1. /schedule "Couldn't load schedule" — root cause and fix

**Root cause (confirmed via network logs).** Every `apiFetch` call now attaches the `x-admin-secret` header (read from `localStorage.getItem("nba_admin_secret")`), because the user previously typed it on `/commissioner`. The `schedule` edge function's CORS preflight does NOT list `x-admin-secret` in `Access-Control-Allow-Headers`, so the browser blocks the request with `Failed to fetch`. Six other endpoints have the same gap (`health`, `last-game`, `nba-injury-report`, `players-list`, `schedule-impact`, `schedule`, `youtube-recap-lookup` — all use inline CORS without `x-admin-secret`).

The schedule edge fn itself is healthy — `curl_edge_functions GET /schedule?gw=10&day=1` returned 200 with the GW10 data. This is purely a browser CORS preflight rejection.

**The right fix is client-side, not bandage-the-7-functions.** The admin secret should only travel with admin endpoints; sending it on every read endpoint is both a CORS footgun and a leakiness concern.

In `src/lib/api.ts` (lines 54-63), gate the `x-admin-secret` header on the path:
```ts
const ADMIN_PATHS = new Set([
  "import-players",
  "import-schedule",
  "import-game-data",
  "sync-sheet",
  "salary-update",
  "youtube-recap-lookup",
]);
const isAdminPath = [...ADMIN_PATHS].some((p) => path.startsWith(p));
if (isAdminPath) {
  const adminSecret = typeof window !== "undefined" ? localStorage.getItem("nba_admin_secret") : null;
  if (adminSecret) adminHeader = { "x-admin-secret": adminSecret };
}
```

**Secondary safety net (optional, recommended).** Update the seven inline-CORS edge functions to also list `x-admin-secret` in `Access-Control-Allow-Headers`. This way, future header additions don't break things if the gating logic is ever forgotten. Touch only the `corsHeaders` const in: `schedule`, `schedule-impact`, `players-list`, `last-game`, `health`, `nba-injury-report`, `youtube-recap-lookup`. (Cheap one-line additions.)

---

### 2. Active nav shimmer — match the TRADE button feel + reduced-motion

The TRADE button uses a sweeping `after:` shimmer that fires on hover, persistent accent glow, and a subtle scale. The current `.nav-item.active` has the glowing left bar but no continuous "alive" animation, and the hover shimmer fires on inactive items only.

In `src/index.css`:
- Adjust the existing `.nav-item::after` shimmer: shorten duration from `0.7s` to `0.5s`, increase opacity slightly (`hsl(0 0% 100% / 0.10)`), keep the `transform: translateX(-100%)` → `100%` recipe.
- Add a **continuous low-amplitude shimmer to `.nav-item.active::after`** (separate keyframes — `nav-active-shimmer`) that loops every 3.5s with a wide gap (so it doesn't feel busy). Use the same accent gradient as the left bar.
- Pulse the left bar's `box-shadow` between `0 0 12px -2px hsl(var(--accent)/0.6)` and `0 0 18px -2px hsl(var(--accent)/0.9)` over 2.6s (matches the TRADE button's persistent glow rhythm).
- Wrap **all** new keyframe-driven animations (active shimmer + glow pulse) in:
  ```css
  @media (prefers-reduced-motion: reduce) {
    .nav-item.active::after { animation: none; }
    .nav-item.active::before { animation: none; box-shadow: 0 0 8px -2px hsl(var(--accent)/0.5); }
    .nav-item:hover::after { transition: none; transform: none; }
    .nav-item:hover { transform: none; }
  }
  ```
- Keep the existing inactive-hover shimmer + `translate-x-0.5` slide; just gate them behind reduced-motion as above.

No JS changes — pure CSS.

---

### 3. Collapsed-sidebar tooltips for nav items

Today, `AppLayout.tsx` already passes `title={collapsed ? label : undefined}` (line 84), but native `title` tooltips are inconsistent across browsers (different delays, no styling, sometimes truncated). The rest of the app uses Radix `Tooltip` (from `@/components/ui/tooltip`), so let's match.

In `src/components/layout/AppLayout.tsx`:
- Import `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger` from `@/components/ui/tooltip`.
- Wrap the entire `<aside>`'s nav `<nav>` in a single `<TooltipProvider delayDuration={0} skipDelayDuration={200}>`.
- For each `NavLink`, when `collapsed === true`, wrap it in `<Tooltip><TooltipTrigger asChild>…</TooltipTrigger><TooltipContent side="right" sideOffset={12} className="font-heading uppercase text-[10px] tracking-[0.2em]">{label}</TooltipContent></Tooltip>`.
- When expanded, render the NavLink directly (no tooltip needed — label is visible).
- Drop the `title=` prop now that we have proper tooltips.
- Apply the same Tooltip treatment to the bottom controls (theme toggle, collapse, sign-out) when collapsed — for consistency. They already have `title=`, so swap to Radix Tooltip with `side="right"`.

This gives consistent dark-themed tooltips with instant appearance on hover and proper portaled positioning across all routes.

---

### 4. Advanced stats CSV import + surface across UI

#### 4a. Confirming the column mapping (NBA-specialist read)

The CSV header is `ID,NAME,TEAM,FGM,FGA,FG_PCT,3PM,3PA,3P_PCT,FTM,FTA,FT_PCT,OREB,DREB,TOV,PF,PLUS_MINUS`. These are **season totals** (not per-game), confirmed by sample magnitudes (Jokić: 644 FGM is end-of-regular-season totals territory). Mapping for storage:

| CSV column | DB column (new) | Type | Notes |
|---|---|---|---|
| `ID` | `id` (existing PK) | int | Match key |
| `NAME` | (display only) | — | Used only for human-eyeballing import results |
| `TEAM` | (display only) | — | Same |
| `FGM` | `fgm` | int | Field goals made (season total) |
| `FGA` | `fga` | int | Field goals attempted |
| `FG_PCT` | `fg_pct` | numeric | Decimal (0.569 = 56.9%) |
| `3PM` | `tpm` | int | 3-pointers made (col name `tpm` because Postgres identifiers can't start with a digit) |
| `3PA` | `tpa` | int | 3-pointers attempted |
| `3P_PCT` | `tp_pct` | numeric | Decimal |
| `FTM` | `ftm` | int | Free throws made |
| `FTA` | `fta` | int | Free throws attempted |
| `FT_PCT` | `ft_pct` | numeric | Decimal |
| `OREB` | `oreb` | int | Offensive rebounds (season total) |
| `DREB` | `dreb` | int | Defensive rebounds (season total). Note: `players.reb` already exists as per-game avg; OREB+DREB ≠ that. We store both totals as new columns. |
| `TOV` | `tov` | int | Turnovers |
| `PF` | `pf` | int | Personal fouls |
| `PLUS_MINUS` | `plus_minus` | int | Cumulative season +/- |

All numeric, all season totals, all nullable (defaults to NULL when player isn't in the CSV — e.g. G-League call-ups added mid-season). One row per player, matched on `id`.

#### 4b. Database migration

New migration adds the 14 columns to `players` (all nullable, no default needed — NULL signals "data not loaded for this player"):
```sql
alter table public.players
  add column if not exists fgm int,
  add column if not exists fga int,
  add column if not exists fg_pct numeric,
  add column if not exists tpm int,
  add column if not exists tpa int,
  add column if not exists tp_pct numeric,
  add column if not exists ftm int,
  add column if not exists fta int,
  add column if not exists ft_pct numeric,
  add column if not exists oreb int,
  add column if not exists dreb int,
  add column if not exists tov int,
  add column if not exists pf int,
  add column if not exists plus_minus int;
```
Existing RLS (`Players: public read`) covers reads; nothing else needed.

#### 4c. New edge function: `import-player-advanced-stats`

A small admin-guarded function that accepts `{ rows: Array<{id, fgm, fga, ...}>, replace?: boolean }` and upserts into `players` by `id`, only updating the 14 advanced-stat columns (does not touch name, team, salary, etc.). Mirrors the structure of `import-players` (`requireAdmin`, batched upsert, returns `{updated, skipped, errors}`). When `replace: true` is passed, it sets all 14 columns to NULL for players whose ID is NOT in the incoming list — so end-of-season uploads cleanly wipe stale data for players no longer in the league. CORS includes `x-admin-secret`. No `verify_jwt` change needed (gateway-default OK).

#### 4d. Commissioner UI — new card

Add a third upload card to `/commissioner` next to "Import Game Data" and "Import Schedule":
- **Title:** "Import Player Advanced Stats" (use `BarChart3` icon).
- **Description:** "End-of-Regular-Season totals: FGM/A, 3PM/A, FT, OREB, DREB, TOV, PF, +/-."
- File input accepts `.csv,.tsv,.txt`. Parser auto-detects comma vs tab delimiter.
- Preview pane (reuse the existing pattern from the player TSV preview): show first 10 parsed rows in a table, plus row count.
- "Replace" toggle (default on for end-of-season uploads).
- Confirm button posts to `import-player-advanced-stats` with admin secret.
- Success toast: "Updated N players with advanced stats."

#### 4e. Surface the new fields

**Contracts (`src/lib/contracts.ts`).** Extend `PlayerSeasonSchema` (or add `PlayerAdvancedSchema` and attach it as `player.advanced`) with the 14 fields, all `NumSchema.nullable().optional()`. I'll choose `PlayerAdvancedSchema` as a sibling to keep `season` semantics intact.

**Edge functions:**
- `players-list/index.ts` — add `advanced: { fgm: p.fgm, fga: p.fga, fg_pct: p.fg_pct, tpm: p.tpm, tpa: p.tpa, tp_pct: p.tp_pct, ftm: p.ftm, fta: p.fta, ft_pct: p.ft_pct, oreb: p.oreb, dreb: p.dreb, tov: p.tov, pf: p.pf, plus_minus: p.plus_minus }` to each item.
- `player-detail/index.ts` — same `advanced` block.
- `ai-coach/index.ts` — extend `buildPlayerSummary()` to include compact shooting splits where signal is highest: `fg_pct`, `tp_pct`, `ft_pct`, `oreb` (offensive rebounding role), `tov` (ball security), `plus_minus` (impact). Skip raw made/attempted to keep the prompt small. Add a one-line note in the SYSTEM_PROMPT: "Player advanced stats include shooting efficiency (fg_pct, tp_pct, ft_pct), OREB (offensive rebounding role), TOV (ball security), and plus_minus (on-court impact). Consider these for waiver/trade decisions."

**Player Modal — premium "Advanced Stats" section:**
Add a new row of stats below the "Full Season Stats" `BreakdownCard`, only visible when `data.player.advanced` has any non-null value. Layout: a single rounded card titled "REGULAR SEASON SHOOTING & IMPACT", with a 7-column grid:
- FG%, 3P%, FT% (formatted as `56.9%`, dimmed if <30% / boosted in green if >50% for FG, etc.)
- OREB, DREB (small "TOTALS" eyebrow)
- TOV, +/- (with red/green tint based on sign for +/-)
The card uses the same `bg-muted rounded-lg p-3 border` recipe as `BreakdownCard` for visual consistency. On the `Stats` tab, also add `OREB`, `DREB`, `TOV`, `+/-` to the 2-column grid (4 new tiles).

#### 4f. My Roster List view — College + Height columns

In `src/components/RosterListView.tsx` and `src/components/PlayerRow.tsx`:
- Add two new `<TableHead>`: "College" and "HT" (kept abbreviated to save horizontal real estate; tooltip "Height").
- Insert them between the existing player-name cell and the FC/BC cell.
- College renders as plain truncated text (`max-w-[120px] truncate`, with `title={core.college ?? ""}` for full-name tooltip on hover); falls back to `—` when null.
- Height renders the raw string from the DB (e.g. `6'11"`); falls back to `—`.
- `core.college` and `core.height` are already in the contract — no schema change.

(The Court view stays untouched — too cramped for these fields and they'd hurt the cinematic look.)

---

### 5. Player Modal header — premium watermark + College/Height + bigger salary

Refresh the header block (`src/components/PlayerModal.tsx`, lines 153-191):

**Replace the small inline team logo + the bottom-right team watermark** with the same oversized rotated watermark recipe used in the TradeReport IN/OUT cards. Specifically:
- Drop the existing `top-4 right-4 w-20 h-20 opacity-[0.06]` team logo (line 140) and the inline 4×4 logo next to the team text (line 164).
- Add an oversized rotated team-logo watermark anchored to the **top-right corner of the header block**, escaping the dialog's rounded edge: `absolute -top-3 -right-3 h-32 w-32 object-contain opacity-[0.18] -rotate-12 select-none pointer-events-none`. Use `getTeamLogo(core.team)`. Keep the existing center NBA watermark (line 137) — it's a different layer and works fine.
- Wrap the dialog's content in `relative overflow-hidden` (already there) and ensure the watermark `<img>` sits at z-index 0 with header content at z-10.

**Premium typographic upgrade for the bio strip:**
- Player name stays bold uppercase, bump to `text-base` (was default).
- Below name, **two lines** instead of one cluttered line:
  - Line A: `{TEAM} · #{jersey} · {pos}` — same as today, but slightly stronger — `text-xs font-heading font-semibold tracking-[0.18em] text-foreground/85`.
  - Line B (new): `{height ?? "—"} · {college ?? "—"}` — rendered in `text-[10px] uppercase tracking-[0.2em] text-foreground/55`. Lines A+B form a 2-row "scoreboard" feel.
- Salary pill: bigger and bolder. Move from a 12px text inline next to the FC/BC badge into its **own pill** to the right of the bio block:
  ```tsx
  <div className="ml-auto inline-flex items-baseline gap-0.5 rounded-lg px-2.5 py-1 bg-accent/10 border border-accent/30">
    <span className="text-[9px] font-heading uppercase tracking-[0.25em] text-muted-foreground">$</span>
    <span className="font-mono font-bold text-lg text-foreground leading-none">{core.salary}</span>
    <span className="text-[10px] font-heading uppercase text-muted-foreground/70">M</span>
  </div>
  ```
  This makes salary the visual anchor on the right (countering the watermark on the same side).
- FC/BC badge stays in the bio block (line A), small and unchanged.

**Action icons (Compare, Wishlist):** keep their current placement and styling but move them to a small floating cluster in the top-right *below* the close button (so they don't fight the watermark). Use `absolute top-12 right-3 flex flex-col gap-1` — vertical stack of small icon buttons.

The result mirrors the TradeReport player card rhythm: oversized rotated logo invading the corner, premium typographic stack of name → bio → secondary bio, and a strong colored pill for the headline number ($M).

---

### Files touched

1. `src/lib/api.ts` — gate `x-admin-secret` header behind admin paths only (3 lines).
2. `supabase/functions/{schedule,schedule-impact,players-list,last-game,health,nba-injury-report,youtube-recap-lookup}/index.ts` — add `x-admin-secret` to `Access-Control-Allow-Headers` (1 line each, defensive).
3. `src/index.css` — adjust nav shimmer timing/intensity, add active glow pulse keyframes, add `prefers-reduced-motion` block.
4. `src/components/layout/AppLayout.tsx` — wrap collapsed nav items in Radix `Tooltip`, drop native `title` prop.
5. New SQL migration — add 14 advanced-stat columns to `players`.
6. New edge function `supabase/functions/import-player-advanced-stats/index.ts` — admin-guarded upsert + optional replace-mode NULL-fill.
7. `src/lib/contracts.ts` — add `PlayerAdvancedSchema`, attach to `PlayerListItem` and `PlayerDetail` payloads.
8. `supabase/functions/players-list/index.ts` and `supabase/functions/player-detail/index.ts` — emit `advanced` block.
9. `supabase/functions/ai-coach/index.ts` — extend `buildPlayerSummary` with shooting splits, OREB, TOV, +/-; add one-line system-prompt note.
10. `src/pages/CommissionerPage.tsx` — add "Import Player Advanced Stats" card with file picker, preview, replace toggle, confirm button.
11. `src/components/RosterListView.tsx` and `src/components/PlayerRow.tsx` — add College + Height columns (List view only).
12. `src/components/PlayerModal.tsx` — premium header rebuild with rotated team-logo watermark, bigger salary pill, College/Height row, repositioned action icons.

### Out of scope

- Exposing per-game advanced stats (eFG%, true shooting, usage rate). The CSV is season totals only; deriving per-game would require dividing by GP elsewhere — separate task.
- Adding the new fields to the table on `/transactions` (right-side players table) — keep that surface focused on the trade decision flow.
- Backfilling historical advanced-stats snapshots over time. The new columns are a single "current value" snapshot that gets fully replaced on each end-of-season upload.
- Re-styling the rest of the Player Modal (Stats grid, History table, Schedule tab, AI Explain) — only the header block changes.
