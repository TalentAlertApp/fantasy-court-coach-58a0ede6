## Scope

Three items: (1) cross‑league YouTube recap fetching that respects quota, (2) finish leftover items from the previous plan, (3) make the page‑level Chips actually do something instead of being cosmetic.

---

### 1) `youtube-recap-lookup` — don't waste API calls; continue across leagues

Today the function takes either a single `game_id`, an `ids=` list, or a generic missing‑recap scan (FINAL games where `youtube_recap_id IS NULL`). The /commissioner page exposes two separate league panels (NBA, WNBA) and triggers each scan independently.

Changes (no DB migration):

- Edge function `supabase/functions/youtube-recap-lookup/index.ts`:
  - Accept new optional `league=nba|wnba|both` query param.
  - Build the candidate game list scoped by league via `leagues.code` join (`league_id IN (...)`), so a "wnba" run only pulls WNBA games and never burns quota on NBA games (and vice‑versa).
  - With `league=both` (default for cross‑league runs): order candidates so we exhaust the **smaller** missing set first, then continue into the other league inside the same invocation. Stop early if quota 403 is observed. Return per‑league counters in the response (`{ processed_nba, found_nba, processed_wnba, found_wnba, quota_exhausted }`).
  - Already non‑destructive (only writes when a videoId is found) — keep that.

- /commissioner UI (`src/components/commissioner/MissingRecapsPanel.tsx` and `src/pages/CommissionerPage.tsx`):
  - Add a single "Re‑scan Missing (Both Leagues)" button at the top that calls the function once with `league=both`, then refetches both panels' missing lists.
  - Per‑league panel buttons keep working but pass `league=<code>` so they only consume quota for that league.
  - Surface `quota_exhausted` as a soft warning toast with remaining counts so the user knows to retry tomorrow.

### 2) Resume previous plan — remaining items

From the prior plan, the items still outstanding after the WNBA‑deadlines / Court Show / sidebar / standings batch:

- **/MY ROSTER WNBA fixes** (`src/components/transactions/RosterPane.tsx`, `src/pages/PlayersPage.tsx`):
  - Schedule modal default GW: pass page‑resolved `{gw, day}` (already from `useLeagueDeadlines`) instead of any hard‑coded GW 25.
  - Schedule grid: filter `schedule_games` by `league_id` and cap day list by WNBA deadlines for WNBA teams.

- **Player modal header icons** (`src/components/PlayerModal.tsx`): finish the chip treatment for light theme (rounded `bg-muted/60`, hover `bg-muted`, accent on active state) so the icons read in both themes.

- **/schedule WATCH RECAP fallback** (`src/components/ScheduleList.tsx`, `src/components/court-show/CourtShowModal.tsx`): when `youtube_recap_id` is present → embed YouTube (current behaviour). When it is missing but the schedule row carries a `wnba.com/...?watchRecap=true` URL → render an outbound "Open recap on WNBA.com ↗" button instead of trying (and failing) to iframe a `X-Frame-Options: SAMEORIGIN` page.

- **Court Show auto‑pause on Outstanding Game video play** (`src/components/court-show/CourtShowModal.tsx`, `useCourtShowAudio.ts`): when the embedded YouTube player reports `playing`, pause the slide auto‑advance timer; resume when the video reports `paused`/`ended` or the user manually advances.

### 3) Chips — wire All‑Star and Wildcard into real game logic

Right now `chipAllStar` / `chipWildcard` only widen `gwCap` locally on /transactions and never persist; the moment the page re‑mounts the chip is gone, and the trade‑commit path never knows a chip was used. There is no "Captain" page chip — Captain is already real (per‑roster `is_captain` with the DB scoring multiplier), so we keep it as is and only fix the two page chips.

DB (single small migration):

```sql
create table public.team_chips (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  league_id uuid not null,
  gw int not null,
  chip text not null check (chip in ('all_star','wildcard')),
  used_at timestamptz not null default now(),
  unique (team_id, chip)            -- each chip can be used once per season
);
alter table public.team_chips enable row level security;
-- owner-only RLS via teams.owner_id, mirroring transactions policies
```

Edge function `transactions-commit/index.ts`:
- Accept `chip?: 'all_star' | 'wildcard'` in the request body.
- Reject if the chip was already used (`team_chips` row exists for that chip+team).
- Use chip semantics during validation:
  - `wildcard`: bypass the GW transfer cap entirely for this commit and skip excess‑transfer cost.
  - `all_star`: raise the effective cap by +2 for this GW only.
- On success, insert a `team_chips` row so the chip is consumed.

Frontend (`src/pages/PlayersPage.tsx`, `src/components/transactions/TradeWorkbench.tsx`):
- Load used chips for the current team via a small `useTeamChips(teamId)` query and disable a chip's button when it's already been spent (with a "Used" badge + tooltip showing GW it was used in).
- Pass the active chip into `handleCommit` → `transactions-commit` body.
- Keep the local `gwCap` math but derive it from the same source of truth (used vs. active chip) so the UI matches what the server enforces.
- Show a confirmation step ("Use Wildcard for GW X? This chip can only be used once.") before commit when a chip is active.
- Update `HowToPlayModal.tsx` Chips section to describe the now‑real behaviour and the "once per season" rule.

Out of scope: any new chip beyond All‑Star and Wildcard; changing Captain semantics; UI redesign of the chip buttons.

---

### Order of execution

1. Migration for `team_chips` + RLS.
2. Edge function changes: `youtube-recap-lookup` cross‑league, `transactions-commit` chip handling.
3. Frontend wiring for chips + commissioner cross‑league button.
4. Finish leftover items from the previous plan (RosterPane, PlayerModal icons, WATCH RECAP fallback, Court Show auto‑pause).
5. Smoke test: NBA + WNBA roster commit with each chip; cross‑league recap scan from /commissioner.
