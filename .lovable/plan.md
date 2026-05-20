## Goal

Make Ballers.IQ cards feel like editorial writing instead of dashboard chips, and add a contextual league/team watermark in the top-right corner of each card.

## Changes

### 1. Edge function — richer narrative, drop stat strips
File: `supabase/functions/court-show-intelligence/index.ts`

- Bump `VALIDATOR_VERSION` to `6` to force regeneration of all cached rows.
- Update the LLM prompt for the 4 cards (form / matchup / schedule / market):
  - Require **2–3 full sentences** in `body` per card.
  - Numbers should be **woven into prose** ("Caitlin Clark is averaging 52.3 FP over her last five, fueled by 31 minutes a night and a slate-best $0.13 per fantasy point"), not standalone tokens.
  - Each of the 4 cards must cover a **distinct angle** (no repeated facts across cards): matchup→game leverage/pace/tipoff, form→hot-hand anchor, schedule→slate shape/B2B/density, market→value or salary movement.
  - Pass the same server-computed metrics already used today as grounding so numbers stay real; the model writes prose, server still validates league terms.
- Stop populating `card.stats` and `card.subtext` for the 4 main index cards (set to `undefined` after generation, and remove the `attachStats` calls for these kinds). Keep the type optional so older cached rows degrade cleanly.
- Backfill paths (when LLM output is filtered) get the same narrative treatment: deterministic 2–3 sentence templates using the slate's real anchor player / leaders / tipoff / B2B counts, with league-correct phrasing ("tonight's WNBA slate" vs "tonight's NBA slate").
- Add a `league` field already present on each card; ensure backfill copy uses it.

### 2. Frontend — render prose, add watermark, remove stat grid
File: `src/components/court-show/CourtShowSlide.tsx` (only `AICardView`)

- Remove the `card.stats` grid block and the `card.subtext` italic line from `AICardView`.
- Let the `body` paragraph breathe: bump from `text-[11px] leading-snug` to `text-[12.5px] leading-relaxed` so multi-sentence prose reads well.
- Add a top-right **watermark** inside the card container:
  - If `hasGameTeams` (away+home tricodes present) → render the league logo (`wnbaLogo` when `leagueCode === "wnba"`, else `nbaLogo`).
  - Else if `cleanTeam` or the card has a `player` with a team → render that team's logo via `getWnbaTeamLogo(tri)` (WNBA) or `getTeamLogo(tri)` (NBA).
  - Fallback: league logo.
  - Style: absolutely positioned `top-2 right-2`, ~`h-9 w-9`, `object-contain`, `opacity-[0.18]`, `pointer-events-none`, sits behind text (`z-0`); existing content wrapped so it renders above (`relative z-[1]`).
- Plumb `leagueCode` (already passed into `CourtShowSlide` props) down into `AICardView` via a new prop.

### 3. Types
File: `src/components/court-show/types.ts`

- Keep `stats?` / `subtext?` on `AIBallersIQCard` (optional) so old rows don't crash, but they will no longer be rendered.

## Out of scope

- Other slides (recap podium, matchups grid, captain, etc.) keep their stat strips.
- No new tables or migrations beyond the validator bump (existing stale-cache invalidation already triggers regeneration when `_v` changes).
- No copy changes outside the 4 Ballers.IQ cards.