## Plan — /teams Stats tab polish

Scope: `src/components/teams/TeamStatsPanel.tsx` only. No data/business logic changes.

### 1. Scrollable tables
Wrap the table container in a fixed-height scroll region so every category (Fantasy, Efficiency, Depth, Schedule) scrolls vertically while keeping the column header sticky.
- Outer wrapper: `max-h-[60vh] overflow-y-auto` (fall back to `min-h-0 flex-1` if the page allows).
- `<thead>` gets `sticky top-0 z-[2] bg-muted/80 backdrop-blur` so headers stay visible while scrolling.
- Horizontal scroll preserved.

### 2. Player photo + flag inline (no new columns)
Add a small avatar + flag inside the existing player cell, reusing app patterns:
- Fantasy → **Top FP Player** cell: 18px round photo (fallback grey circle) · player name · `<NationalityFlag country={core.nationality} size="xs" />`.
- Efficiency → **Best Value Player** cell: same composition.
Add `nationality?: string | null` to the local `Player.core` type so TS stays happy (real payload already carries it — confirmed via PlayerRow usage).

### 3. Grade color scale (best 3 green / worst 3 red)
Introduce a small helper `rankColor(value, allValues, { invert? })` that:
- Sorts unique numeric values, returns a Tailwind class:
  - Top 1: `text-emerald-400 font-semibold`
  - Top 2–3: `text-emerald-500/80`
  - Bottom 1: `text-rose-400 font-semibold`
  - Bottom 2–3: `text-rose-500/80`
  - Else: default
- Skips zero / non-finite values (treated as neutral) so empty cells don't poison the ranking.

Applied to:
- **Efficiency**: `Team FP/G`, `FP / $M`, `Avg Value`, `Score`, `Salary Total` (high salary = worst → invert), **excluding** Best Value Player and Team.
- **Depth**: `Top 3 Share` (low = best → invert), `Depth Share`, `Depth Index`.
- **Schedule**: `This GW`, `Next 7d`, `Score`.

Computed once per render from the visible `rows` so it follows the search filter. Implemented by precomputing a `Map<string, Map<tricode, className>>` per column key inside `StatsTable`.

### 4. Header tooltips
Wrap every sortable `<th>` label (except `Team` and `Next Opp`) in a shadcn `Tooltip` from `@/components/ui/tooltip`. Tooltip text per column:

- **Fantasy**: GP — Games played · Record — Wins-Losses · Team FP/G — Season fantasy points scored per game by the whole team · Last 5 FP/G — Same metric using each player's last 5 played games · Δ FP — Last 5 minus season FP/G (positive = trending up) · Top FP Player — Best fantasy producer on the team · Top FP/G — Their season FP/G · FC FP/G — Total FP/G from Front Court players · BC FP/G — Total FP/G from Back Court players.
- **Efficiency**: Team FP/G — Season FP per game · FP / $M — Fantasy points produced per $1M of salary · Avg Value — Average per-player value index · Score — Best value player's value score · Salary Total — Combined player salaries in $M (lower = cheaper roster).
- **Depth**: Players — Total rostered players · Active — Players with playing time / FP this season · FC / BC — Counts by position group · Top 3 Share — % of team FP scored by the top 3 producers (lower = more balanced) · Depth Share — Inverse of Top 3 Share · Depth Index — 0–100 balance score (higher = deeper rotation) · Star Dep. — Star dependency label.
- **Schedule**: Upcoming — Total remaining games · This GW — Games in the current gameweek · Next 7d — Games tipping off in the next 7 days · Tipoff — Date/time of the next game · Score — Volume score (Next 7d × 2 + This GW) · **Outlook** — Schedule outlook based on games in the next 7 days: **Strong** ≥ 4 games · **Good** = 3 games · **Neutral** = 2 games · **Light** ≤ 1 game.

### Technical notes
- All work in `TeamStatsPanel.tsx`; no schema or query changes.
- Use existing components: `NationalityFlag`, `Tooltip`/`TooltipTrigger`/`TooltipContent`, `cn`.
- Keep current sort/click-through, summary cards, and category pills untouched.
- Color classes stay token-friendly (emerald/rose are part of current palette and already used elsewhere in this file).
