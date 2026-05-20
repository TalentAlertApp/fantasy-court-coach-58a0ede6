## Goal

Make the 4 Ballers.IQ cards on the Daily Court Show feel rich and data-driven instead of one-line generic copy. Every enrichment stays scoped to the active league (WNBA for a WNBA team, NBA for an NBA team) — no cross-league data, no off-slate teams.

## What changes per card

Each card keeps its current 1-line headline + body and gains a structured `stats` block plus richer anchoring metadata. The slide UI gets a small stats strip under the body and a richer footer (team, opponent, salary, FP5).

### 1. Matchup Index
- Headline: `AWAY @ HOME` (existing).
- Body: 1 short narrative line.
- New stats strip (3-4 chips): `Tip` (Lisbon time), `Pace edge`, `Top FP5 (away)` & `Top FP5 (home)`.
- Picks the slate's "highest-leverage" upcoming game by combined top-2 FP5 of both rosters.

### 2. Form Index
- Anchors on top FP5 producer across slate rosters (not on training data).
- Body references player + team + concrete FP5 / MPG5.
- Stats strip: `FP5`, `MPG5`, `Salary`, `$/FP` (salary efficiency).
- Footer: player chip (photo + name) + team badge (existing chip).

### 3. Schedule Index
- Body: "{N} games on slate · {weekday}" + back-to-back / rest note.
- Stats strip: `Games`, `B2B teams`, `Rest-advantage teams`, `Earliest tip`.
- Computed from `schedule_games` and prior-day tip checks scoped to current league.

### 4. Market Index
- Anchors on highest `$/FP` producer (cheap + productive) among slate rosters.
- Body names that player.
- Stats strip: `Salary`, `FP5`, `$/FP`, `Δ7d` (salary delta last 7 days from `player_salary_changes`).
- Footer: player chip + team badge.

If the AI generates `role_stability` as the 4th kind, it gets:
- Stats strip: `Confirmed starters`, `Out`, `Questionable`, `New roles` (counts from health/availability data already used by Health Watch).

## Edge function changes (`court-show-intelligence`)

1. Bump `VALIDATOR_VERSION` to `5` to force regeneration of all rows (new shape).
2. Extend `AICard` / response card shape with optional `stats: { label: string; value: string }[]` and `subtext?: string`.
3. Pre-compute slate-scoped metrics server-side (league-isolated):
   - For each slate team: top 2 players by FP5 (from `player_game_logs` last 5 played, joined to `players` filtered by `league_id`).
   - For each slate player: salary, FP5, MPG5, `$/FP`.
   - Salary 7-day delta via existing `get_salary_movers(_days := 7, _league_id := league_id)`.
   - Back-to-back: teams in slate that also played the previous calendar day in the same `league_id`.
   - Earliest tip (Europe/Lisbon).
4. Pass these metrics to the LLM payload so the model can write grounded copy, AND also use them as the source of truth for the deterministic `stats` array we attach AFTER validation (model never authors the stat numbers — we always overwrite with server-computed values keyed off the card's referenced player/game/league).
5. Backfill / fallback branches build the same `stats` array, so cards are always rich even when the model fails or is disabled.
6. League guard rails stay as-is (`buildForeignTermChecker`, `allowedNames`, `allowedTris`, `league` stamp, `_v` stamp) — applied to the new `stats` strings as well (a stat value like a player name on the wrong team is dropped).

## Frontend changes

1. `src/components/court-show/types.ts`: add `stats?: { label: string; value: string }[]` and `subtext?: string` to `AIBallersIQCard`.
2. `src/components/court-show/CourtShowSlide.tsx` → `AICardView`:
   - Render `stats` as a compact 2-4 column chip grid between `body` and the footer (style matches existing `grid-cols-N` stat strip used elsewhere in the file).
   - Render `subtext` (smaller, muted) under the body when present.
   - Keep current player/team footer behavior; tricodes still pass through `cleanTricode`.
3. `useCourtShowData.ts`: no structural change — it already invokes the edge function as the single source of truth; the new fields flow through automatically.

## Cache hygiene

- Bumping `VALIDATOR_VERSION` to 5 makes existing rows stale; the edge function's existing "delete and regenerate" path handles cleanup on next read.
- New migration deletes any `court_show_intelligence` row where the first card lacks the new `stats` field, so old rich-less rows do not linger.

## League isolation guarantees (recap)

- All Supabase queries filter by `league_id` (already in place for `players`, `schedule_games`, `player_game_logs`).
- The new salary-delta call passes `_league_id` explicitly.
- `buildForeignTermChecker` is extended to scan card `stats[].value` strings the same way it scans `body`/`headline`.
- Cards failing any league check are dropped, then the deterministic backfill (also league-scoped) refills to 4.

## Out of scope

- No new tables.
- No UI changes outside `AICardView`.
- No change to the other DCS slides.
