## 1. Attach Team — `non-2xx` error from `leagues-manage/attach-team`

**Root cause (most likely)**

`public.teams.sport_league_id` is **NOT NULL**, but the edge function inserts:
```ts
sport_league_id: tgtLeague.sport_league_id ?? srcTeam.sport_league_id ?? null,
```
Newly-created fantasy leagues (e.g. "WNBA IS MINE") were saved without a `sport_league_id` populated by `leagues-create`, so when the source team also lacks one (or doesn't match the target sport), the insert fails with a NOT NULL violation → 500 → "Edge Function returned a non-2xx status code".

A second contributor: the `roster` clone passes `gw`/`day` straight through, but those columns are NOT NULL — if the source team has rows where they were inserted as 0 it's fine, but mixed-sport roster ids would also fail an FK if the target league's `sport_league_id` differs from the source's.

**Fix**

In `supabase/functions/leagues-manage/index.ts` (`attach-team` action):
1. Resolve the target sport id deterministically: look up `sport_leagues.id where code = tgtLeague.sport` and use that. Fall back to `srcTeam.sport_league_id` only if sports match. Bail with a clear `SPORT_LEAGUE_UNRESOLVED` error if still null instead of letting the DB throw.
2. Before insert, also normalize `tgtLeague.sport_league_id`: if null, persist the resolved value back onto the league row so future attaches don't re-resolve.
3. Skip roster cloning entirely when the source roster references player ids that don't belong to the resolved target sport (defensive — same sport so should pass, but log and continue without aborting the attach).
4. Wrap each step in `try/catch` and return granular error codes (`INSERT_TEAM_FAILED`, `INSERT_ROSTER_FAILED`, etc.) with `details` set to the underlying Postgres message so the toast surfaces the real reason. Add `console.error` lines so the function logs are usable next time.
5. Deploy `leagues-manage` and re-test from `/leagues` (My Leagues row) and `/scoring` (empty state).

No client changes needed — the existing `supabase.functions.invoke("leagues-manage/attach-team", { body })` call routes correctly (verified via curl).

---

## 2. Onboarding audio — play on every onboarding stage incl. Welcome Back + persist mute

**Current state**
- `useOnboardingAudio(active)` is only mounted inside `OnboardingPage` (the create-team flow).
- `WelcomeBackHero` (rendered by `RequireAuth` after login but before entering the app) has no audio hook.
- The mute toggle already writes to `localStorage["courtshow.audio.enabled"]`, but each page reads the pref only on first mount — so the persistence is mostly fine; what's missing is exposing the toggle on Welcome Back and starting playback there.

**Fix**
1. Promote `useOnboardingAudio` → `useAppEntryAudio(active)` (rename + move under `src/hooks/`). Same bed track, same storage key, same `pointerdown`/`keydown` autoplay-unlock retry.
2. Mount it in `WelcomeBackHero` with `active = true`, in addition to `OnboardingPage`. Both share the storage key, so muting in one persists to the other.
3. Add the same mute/unmute icon button to `WelcomeBackHero` (top-right, mirroring the onboarding button) so the user can toggle from either screen.
4. Make the hook subscribe to `storage` events so toggling on one tab/screen is reflected in the other without a reload, and re-read the pref on every mount (already done — confirm).
5. Confirm the swoosh on team-create (`DraftPicker`) still fires regardless of the bed being muted (separate `sfx.muted` key) — no change expected.

---

## 3. Video Recap — wrong/duplicated videos on GW 20.4 (LAL@DEN, DET@SAS)

**Behavior observed**
- LAL@DEN on day 20.4 shows the **LAL@IND** recap, and the real LAL@DEN recap appears (duplicated) on a different day.
- DET@SAS on day 20.4 shows the **LAC@SAS** recap.

**Root cause**

`youtube-recap-lookup` scores YouTube hits by title-token matches and picks the highest score — when a same-night game shares one team and the date string, the wrong title can tie/beat the right one (e.g. "Lakers vs Pacers" wins over "Lakers vs Nuggets" because both contain "lakers", and the date token tips it). Once written, the value sticks because the function only re-runs on games still `is null`.

**Fix (no bulk wipe — surgical re-fetch)**

1. Tighten scoring in `supabase/functions/youtube-recap-lookup/index.ts`:
   - Require BOTH away_city AND home_city tokens to be present for a non-zero score (currently each contributes independently, so a single-team match still scores).
   - Add a **hard reject** if the title contains a *different* known team city for the same league on the same night (build a quick set of "all other teams playing this date" from `schedule_games` and reject if any appears in the title).
   - Bump primary `minScore` to `6` (NBA) / `5` (WNBA) once both-team-required is in.
2. Add a new admin endpoint flag `mode=audit&gw=<n>&day=<n>` that, for the given gameday, **null-and-refetches every game's recap** (per-game replace, never bulk-wipe outside the gameday). Returns a per-game `{game_id, before, after, accepted}` report so we can verify before/after.
3. Run the audit for GW 20 / Day 4 (NBA) immediately after deploy via `curl_edge_functions`. The two reported games and any neighbour collisions should self-correct.
4. Leave the rest of the table untouched.

### Technical details (for the dev pass)

- `leagues-manage/index.ts`: rewrite the `attach-team` block as described in §1; add helper `resolveSportLeagueId(sport: 'nba'|'wnba')`.
- `useOnboardingAudio.ts` → `useAppEntryAudio.ts`; update imports in `OnboardingPage.tsx`; add to `WelcomeBackHero.tsx` with matching mute button.
- `youtube-recap-lookup/index.ts`: extend `scoreItems` to take `requiredTokens: string[]` and `rejectTokens: string[]`; add `mode=audit` branch that builds `idsList` from `gw`+`day` then runs the existing per-game flow with `replaceMode=true`.

### Out of scope
- No DB migrations.
- No changes to other Court Show / scoring features.
- No bulk recap wipe.
