## 1) MARKET WATCH — `MarketWatchStudio.tsx`

**a) CoachCast — Best Transfer Move (right cluster cleanup)**
The 4 elements (`Confidence`, `FP5 Gain`, `Simulate`, `Re-scan`) currently use a `col-span-2` 2x2 grid where the Simulate/Re-scan buttons stretch full-width below two stat tiles, looking unbalanced and messy.

Rework the `md:col-span-4` block to a tight vertical broadcast meter:
- Top row: a single inline "Confidence + FP5 Gain" stat bar — two compact pill-stats separated by a divider, both same height, mono-tabular numerals, color-coded (amber / emerald|rose).
- Bottom row: a single primary action (Simulate → swaps to Commit / Invalid once `simResults[0]` exists) followed by a small ghost "Re-scan" icon button anchored to the right. Both share one row height so the right column reads as 2 clean horizontal bands (Stats / Actions), aligned vertically with the left swap card.

**b) All Recommendations — `no_game` chip**
Currently any item in `m.risk_flags` is rendered raw as a destructive chip, so `no_game` shows up literally. Add a friendly label + tooltip map:
- `no_game` → "No game this week"
- `bench_only` → "Bench only"
- `injury` → "Injury risk"
- `salary_drop` → "Salary drop risk"
- fallback: Title-case the key with underscores → spaces.

Also de-duplicate when both DROP and ADD produce the same flag (currently shown once per move, but ensure each unique flag is rendered once).

## 2) /advanced — Playing Time → Fantasy Points

**a) Move tables**
- Remove the `Increased Playing Time` / `Decreased Playing Time` `TrendTable` pair from the `playing-time` `TabsContent` in `AdvancedPage.tsx`.
- Add them to `TrendingTab.tsx` as two extra `LeaderSubject`s ("Minutes Risers" / "Minutes Fallers") using the existing `RotatingLeaderCard` mechanism (or render them as a dedicated row below the rotating cards to keep table fidelity). Preferred: dedicated `<TrendTable>` row beneath the rotating cards so the existing visual is preserved.

**b) New Fantasy Points tables on the (renamed) tab**
Rename the tab from "Playing Time" to **"Fantasy Points"** in:
- `src/lib/advanced-tab-store.ts` (`AdvancedTab` union stays `playing-time` to avoid storage migration; only the `ADVANCED_TAB_LABEL` value changes).
- `AdvancedPage.tsx` `tabsDef` label.
- Section H1 "Playing Time Trends" → "Fantasy Points Leaders".

Render two side-by-side tables in the renamed tab:
- **Top FP** — sorted desc by `season.fp`
- **Less FP** — sorted asc by `season.fp` (with a minimum GP guard)

Columns for both: `Player | FP | FP5 | MPG | V | Δ` where:
- `FP` = `p.season.fp`
- `FP5` = `p.last5.fp5`
- `MPG` = `p.last5.mpg5`
- `V` = `p.computed.value` (season value)
- `Δ` = `p.computed.delta_fp` (FP5 vs season; green if up, red if down)

Source data from `usePlayersQuery({ limit: 1000 })` (already used by Trending) — no new edge function. Build a small `FPLeaderTable` component or reuse `LeaderTable`.

## 3) Fantasy Broadcast Intelligence — light theme tab labels

In `AICoachModal.tsx`, the `TabsList` is on a dark `bg-black/60` strip, but the shadcn `TabsTrigger` base class injects `text-muted-foreground` / `data-[state=active]:text-foreground` which in light theme resolve to near-white text on the dark strip's white-ish overlay = unreadable.

Force theme-independent colors with `!` Tailwind specificity:
- Inactive: `!text-white/75 hover:!text-white`
- Active: `data-[state=active]:!text-amber-50`

Also add `!text-white/75` to the icon's parent so the `lucide` icon inherits the forced color. This keeps the dark broadcast aesthetic intact in both themes.

---

### Technical Notes
- No backend / edge function changes.
- No new dependencies.
- `AdvancedTab` enum keeps `playing-time` key to preserve `localStorage` continuity; only the visible label changes.
- Risk-flag friendly map lives inline in `MarketWatchStudio.tsx` (small, local concern).
- `TrendTable` in `AdvancedPage.tsx` will be extracted/exported (or duplicated minimally) so `TrendingTab.tsx` can render it without circular deps — preferred path is exporting it from a new `src/components/advanced/TrendTable.tsx` and importing in both places.

### Files Touched
- `src/components/ballers-iq/MarketWatchStudio.tsx`
- `src/components/AICoachModal.tsx`
- `src/pages/AdvancedPage.tsx`
- `src/components/advanced/TrendingTab.tsx`
- `src/lib/advanced-tab-store.ts`
- `src/components/advanced/TrendTable.tsx` (new, extracted)
- `src/components/advanced/FPLeaderTable.tsx` (new)
