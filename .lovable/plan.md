## 1. Fix WNBA Auto-Draft / AI Coach draft (root cause)

`supabase/functions/roster-auto-pick/index.ts` ranks candidates by **salary descending** in preseason (no game logs). For WNBA, top salaries are $25M / $23.7M / $21.2M against a $100M cap, so the greedy locks in 4 expensive players (≈$91M) and can't afford the remaining 6 — error: *"Could not assemble valid roster (picked 4: 3 FC, 1 BC, $91.1M)"*.

DB confirms WNBA pool is healthy: 121 FC + 134 BC across 15 teams, all with salaries (avg $8.7M, min $4.5M, max $25M).

**Fix** — make the picker budget-aware so it always assembles 10 valid players, regardless of league:

- Compute `targetAvg = salaryCap / 10` (= $10M).
- In preseason (no game logs), score candidates by **distance to budget target**: `score = -Math.abs(salary - targetAvg)`. This naturally picks balanced mid-tier players, leaving headroom for all 10 slots.
- Add a **fallback retry**: if the first greedy pass produces fewer than 10 valid picks (or violates 5 FC / 5 BC), automatically rerun with a cheapest-first ordering (`score = -salary`) so we always return a feasible roster.
- Keep in-season behavior unchanged (FP / value-per-dollar) when game logs exist.
- Apply the same starter selection guard so starters never exceed cap and always have ≥2 FC / ≥2 BC.

After fix: WNBA Auto-Draft and AI Coach "Draft my squad with AI" both succeed; NBA preseason behavior also improves (no longer cap-locks on superstars).

## 2. Redesign league selector — Create New Team modal

In `src/components/TeamSwitcher.tsx`, replace the small pill row with a **two-card visual picker** (matches the look of an app store league chooser):

- Two large square-ish cards side-by-side under the "League" label.
- Each card: big league logo (~64px) centered on a soft gradient background tinted with the league color, league name in heading font below the logo.
- Active card: accent border + glow shadow + subtle scale (`scale-[1.02]`), inactive: muted border, hover lifts and brightens.
- Add a faint radial-gradient backdrop and a watermark of the same logo at low opacity behind the card for depth (same treatment as the team-modal header watermark).
- Keep keyboard-accessible (`button` with `aria-pressed`).

## 3. Redesign league step in Onboarding (`NameStep`)

In `src/components/onboarding/NameStep.tsx`, the current league row is small pills. Replace with the **same large two-card picker** used in the Create-Team modal, scaled up for the onboarding canvas:

- Logos rendered larger (~96px), with a soft glow and a slow `animate-pulse`-style halo on the active card.
- Card label "NBA" / "WNBA" in the heading font under the logo, plus a one-line subtitle ("National Basketball Association" / "Women's National Basketball Association").
- Keep the existing step layout (between the franchise-name input and the suggestions row) so the page still fits one screen.

To avoid duplicating markup, extract a small shared component `src/components/LeaguePickerCards.tsx` that takes `value`, `onChange`, and a `size` prop (`"md"` for the modal, `"lg"` for onboarding). Both call sites import it.

## Technical Details

**Files to edit**
- `supabase/functions/roster-auto-pick/index.ts` — budget-aware preseason scoring + fallback retry.
- `src/components/TeamSwitcher.tsx` — replace pill row with `<LeaguePickerCards size="md" />`.
- `src/components/onboarding/NameStep.tsx` — replace pill row with `<LeaguePickerCards size="lg" />`.

**File to create**
- `src/components/LeaguePickerCards.tsx` — shared visual league picker (uses existing `nbaLogo` / `wnbaLogo` assets, no new dependencies).

**Verification**
- Create a new WNBA team → Auto-Draft succeeds with 10 players, 5 FC / 5 BC, ≤$100M.
- Open AI Coach → "Draft my squad with AI" → succeeds for both NBA and WNBA teams.
- Create-Team modal and onboarding Step 2 both show large league logo cards with the active state highlighted.
