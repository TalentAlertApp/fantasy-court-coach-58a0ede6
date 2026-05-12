# Plan

Two independent workstreams. Both are frontend-only except where noted.

---

## Part A — /MY ROSTER action bar: chips dropdown + icon-only buttons

**Target file (primary):** `src/pages/RosterPage.tsx` (action bar lives here, alongside `OptimizeDialog`, `AutoPickConfirmModal`, schedule modal trigger, lineup advisor trigger, and Reset button).

### A1. New "Chips" dropdown button
Add a single context-sensitive entry point placed **immediately before RESET**.

- Trigger: icon-only button (lucide `Sparkles` — premium feel, fits "chips/boosters"), with tooltip "Chips & quick actions".
- Uses shadcn `DropdownMenu` to expose 4 items, each with its own icon + label + short helper text:
  1. **All-Star Boost** — icon `Star`. Action: open existing All-Star confirm flow used on /transactions (reuse logic via shared hook). Disabled + "Used GW {n}" caption when `useTeamChips` reports it consumed.
  2. **Wildcard** — icon `Wand2`. Action: same pattern. Disabled when consumed.
  3. **Auto-Pick** — icon `Shuffle`. Action: opens existing `AutoPickConfirmModal`.
  4. **Optimize Lineup** — icon `Zap`. Action: opens existing `OptimizeDialog`.
- Each item has hover tooltip / inline secondary text describing what it does (cap +2 / cap unlimited / fill empty slots / greedy swap optimizer).
- Active/used chip rows show a subtle "Used · GW{n}" muted suffix.
- Chip items 1–2 only appear available when the user is on a roster page that supports them (always, since chips are season-scoped). Wire to `useTeamChips(teamId)` (already exists).

**Note on chip semantics scope:** Chips currently affect **transfers** (cap), not the lineup itself. To avoid silently changing rules: invoking All-Star / Wildcard from /MY ROSTER will navigate the user to **/transactions** with the chip pre-armed (URL param `?chip=all_star|wildcard`), and `PlayersPage.tsx` will read it and pre-select the chip toggle. This keeps a single commit path and avoids duplicating the confirmation/commit pipeline. Tooltip on the dropdown item will say "Apply on Transactions →".

### A2. Convert existing buttons to icon-only
For Schedule, Lineup Advisor, and Reset:
- Strip the visible text label.
- Wrap each in shadcn `Tooltip` with the original label as `TooltipContent`.
- Keep `aria-label` set to the original text for a11y.
- Icons (keep current if already used; otherwise):
  - Schedule → `CalendarDays`
  - Lineup Advisor → `Brain` (or keep current)
  - Reset → `RotateCcw`
- Uniform sizing: `h-9 w-9`, `rounded-xl`, `bg-muted/40 hover:bg-muted`, accent on hover. Same treatment applied to the new Chips button so the row reads as a single premium icon cluster.
- Spacing: `gap-1.5` between icon buttons, a thin `Separator` (vertical) before the destructive Reset.

### A3. Acceptance
- All 4 dropdown items reachable, used chips disabled with caption.
- All three converted buttons work via icon click; tooltips appear on hover and focus.
- No layout shift on narrow viewports (icons stay inline, no wrap before 768px).
- No business-logic changes: cap math, optimizer, auto-pick, reset all behave identically.

---

## Part B — Prompt 1: normalize player health data model

**New module:** `src/lib/health.ts`

### B1. Types
```ts
export type HealthStatus = "OUT" | "Q" | "DTD" | "GTD" | "PROB" | null;
export interface PlayerHealth {
  status: HealthStatus;
  injury_type: string | null;
  estimated_return: string | null;
  notes: string | null;
  updated_at: string | null;
  source: string | null;
  raw_status: string | null;
  reason: string | null;
}
```

### B2. Exports (pure functions, no React)
- `normalizeHealthStatus(input: unknown): HealthStatus`
- `normalizePlayerHealth(player: any, injuryRecord?: any): PlayerHealth`
- `getHealthTone(status): "danger" | "warning" | "muted" | "clear"`
  - OUT → danger; Q/GTD → warning; DTD/PROB → muted; null → clear
- `isHealthUnavailable(h)` — true if status === "OUT"
- `isHealthRisky(h)` — true if status in {Q, DTD, GTD}
- `shouldBlockCaptain(h)` — true if OUT
- `shouldWarnCaptain(h)` — true if Q/DTD/GTD
- `getCaptainHealthWarning(h, name): string | null` — formatted message
- `getOptimizerHealthPenalty(h): number` — OUT: -999 (effectively bench), Q/GTD: -3, DTD: -1, PROB/null: 0
- `getHealthLabel(h): string` — short pill label
- `getHealthTooltipText(h): string` — full sentence with type/return/notes
- `getHealthSortRank(h): number` — null:0, PROB:1, DTD:2, GTD:3, Q:4, OUT:5

### B3. Normalization rules
Map (case-insensitive, trimmed):
- `out`, `inactive`, `suspended`, `not with team`, `g league`, `g-league`, `personal` (when paired with absent), `rest` → `OUT`
- `questionable` → `Q`
- `day-to-day`, `day to day`, `dtd` → `DTD`
- `game-time decision`, `gtd` → `GTD`
- `probable`, `available probable` → `PROB`
- `active`, `available`, empty, null, undefined → `null`
- Unknown non-empty string → `Q` (conservative warning). If string contains "out" → `OUT`.

`normalizePlayerHealth` reads (in priority order):
1. `injuryRecord` from `nba-injury-report` / `wnba-injury-report` (status, injury_type, estimated_return, notes, last_updated, source).
2. `player.flags.injury` (legacy raw string).
3. `player.injury` (top-level legacy field on `players` table).
4. `player.note` (last-resort free text).

`raw_status` always preserved for debugging.

### B4. Contract updates (`src/lib/api.ts` + zod schemas wherever they live — likely `docs/API_CONTRACTS.md` informed types in code)
- Extend any `InjurySchema` enum to include `"OUT" | "Q" | "DTD" | "GTD" | "PROB" | null` while still accepting legacy strings (use `z.union([enum, z.string().nullable()])` or `.transform`).
- Add optional `health?: PlayerHealth` to player payload schemas — never required.
- Keep `flags.injury` field for backward compatibility; do not remove.

### B5. Replace decision logic at call sites
For each file, replace ad-hoc string comparisons (`p.injury === "Out"`, `core.injury`, etc.) with `normalizePlayerHealth(...)` + helper predicates. Do **not** add new visible UI in this prompt — only swap logic so behavior is preserved.

Files to touch (read-then-patch, only the conditional reads):
- `src/pages/RosterPage.tsx`
- `src/pages/PlayersPage.tsx`
- `src/pages/SchedulePage.tsx`
- `src/pages/ScoringPage.tsx`
- `src/components/AICoachModal.tsx`
- `src/components/PlayerModal.tsx`
- `src/lib/ballers-iq.ts`
- `src/lib/ballers-iq/playerIntelligence.ts`
- `src/components/ballers-iq/BallersIQMarketWatch.tsx`
- `src/components/court-show/useCourtShowData.ts`
- `src/lib/game-blurbs.ts`

Where a component currently uses `core.injury`, switch to `normalizePlayerHealth(player).status` and treat `core.injury` as a last-resort fallback only inside the normalizer.

### B6. Out of scope (per user instructions)
- No Bottom Action Bar / deadline strip injury feature.
- No Team Modal / Teams page changes.
- No new bulky Health card inside Player Modal.
- No new visible UI beyond preventing regressions.

### B7. Acceptance
- `bun run build` passes; no TS errors.
- `InjuryReportModal` still opens and renders identically.
- AI Coach "Injuries" tab still works.
- All `core.injury` / `p.injury` / `flags.injury` reads in the listed files now go through `normalizePlayerHealth`.
- Sorting / captain-blocking / optimizer behavior unchanged for already-tagged players, and now also fires for previously-missed status spellings (e.g. "Day-To-Day" players that were skipped before).

---

## Execution order
1. Part A (self-contained UI change, ~1 file + small additions).
2. Part B (normalizer + mechanical call-site swaps).
3. Confirm with user before starting Prompts 2–11 of the Health UI series.
