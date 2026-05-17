# Plan

## 0) Scoring + Leagues — "Attach existing team to league"

**Backend (`supabase/functions/leagues-manage/index.ts`)**
- Add `action: "attach_team"` that takes `{ league_id, team_id }`:
  - Verify caller owns `team_id`.
  - Verify `team.sport === league.sport` (NBA→NBA, WNBA→WNBA).
  - Verify team is not already in any league of that sport (or matches existing membership rules — reuse what `leagues-join` does today).
  - Insert into `league_members` (and any membership row `leagues-join` writes) without creating a new team.
  - Return the updated league + team summary.

**Scoring page (`src/pages/ScoringPage.tsx`)**
- When `myTeams.length === 0` AND user has an active team in the same sport as the selected league:
  - Replace "Create a team in WNBA" CTA with two stacked CTAs:
    1. Primary: `Add "<ACTIVE TEAM NAME>" to "<LEAGUE NAME>"` → calls `leagues-manage` `attach_team`.
    2. Secondary link: "Create a new team" → existing onboarding route `/?newTeam=1&sport=…&league_id=…`.
  - On success: invalidate `["league-standings"]`, `["scoring-history"]`, `["league-teams"]`; toast confirmation; stay on `/scoring`.
- When no same-sport active team exists, keep today's CTA (routed to onboarding).

**Leagues page (`src/pages/LeaguesPage.tsx`)**
- In the "My Leagues" tab, for each league where `league.sport === activeSidebarTeam.league_code` AND the active team is not already a member AND the league still accepts teams, render a compact secondary pill: `+ Add "<ACTIVE TEAM>"`.
- Wire it to the same `attach_team` action. On success invalidate league-team caches.

---

## 1) Court Show — "High-Competitive Matchups" parity with "Next Up"

**`src/components/court-show/CourtShowSlide.tsx` (matchups slide only)**

a) Cards:
- Add the two team badge watermarks at top-left (away) and top-right (home), same size/opacity as the `next_games` slide.
- Force every card to the same vertical height (use `min-h-[...]` matching the largest variant, so cards without a "SLATE HAMMER" label stay aligned).
- Move the label (e.g. `SLATE HAMMER`) from current center position to `absolute bottom-2 left-3`. Venue + tipoff remain `bottom-2 right-3`.

b) Slide watermark:
- Use the exact same NBA/WNBA league watermark component used by `next_games` slide (same asset, same positioning, same size, same opacity). Currently the matchups slide uses a larger/different placement — make it identical.

---

## 2) `/schedule` — LIVE badge for in-progress games

**`src/components/ScheduleList.tsx`** (and any other schedule row component used in `SchedulePage`)
- For each game row: derive `isLive = now >= tipoff_utc && now < tipoff_utc + 2h30m && status !== "FINAL"`.
- When `isLive`, render a small badge near the "SCHEDULED"/status pill: pulsing red dot (`bg-red-500 animate-pulse`) + uppercase `LIVE` text. Keep tipoff time visible.
- No live polling — purely client-clock derived. Refresh every 60s via a single `useEffect` interval to keep the badge accurate.

---

## 3) `/` (My Roster) — remove redundant "🟢 Lineup open · locks 03:00 AM"

**`src/pages/RosterPage.tsx` (or the header strip component it uses)**
- Locate the `Lineup open · locks …` line and remove it entirely. Keep the existing deadline countdown card untouched.

---

## 4) Onboarding — Court Show music + swoosh on entry

**Music (Court Show theme)**
- Reuse the same audio asset that `useCourtShowAudio` plays (likely a public `/audio/…` file). Find the path used there.
- Create `src/hooks/useOnboardingAudio.ts` (or inline in `OnboardingPage.tsx`) that:
  - Starts the loop on first user interaction (browser autoplay rules — `pointerdown` / button click on the first step).
  - Stops on unmount or when the user finishes Create Team and transitions to `/` (My Roster).
- Mute/unmute toggle button (top-right corner, same style as Court Show audio toggle) — respects `localStorage` so user preference is remembered across both surfaces.

**Swoosh on "enters court"**
- Add a `swoosh.mp3` (or reuse one if Court Show already has one — check `useCourtShowAudio`'s sfx list).
- In `DraftStep.tsx` / wherever `onFinish` fires, play swoosh, then navigate. Music stops in the same handler.

---

## 5) App rename — "Hoops Fantasy Manager"

Update product name string (keep favicon untouched):
- `index.html`: `<title>` and any `<meta name="apple-mobile-web-app-title">`, `<meta name="application-name">`, OG/Twitter tags.
- `public/manifest.json` (or `site.webmanifest`) if present: `name`, `short_name`.
- Any hard-coded "NBA Fantasy Manager" strings in the sidebar/header/footer (e.g. screenshot shows `FANTASY MANAGER` brand block — confirm via search; only edit if literal "NBA Fantasy Manager" appears).
- Do NOT change favicon files.

---

## 6) Commissioner — scheduled daily runs not firing

**Diagnose first**
- Read current `commissioner_sync_schedules` rows (enabled, run_time_lisbon, last_run_at, last_status, last_error).
- Check if a pg_cron job exists that invokes `commissioner-schedule-tick` every minute. Run `select * from cron.job` via `supabase--read_query`.
- Hit the tick endpoint manually with `?force=sync3` to confirm the function itself works end-to-end.
- Inspect `commissioner-schedule-tick` edge function logs for the last few hours.

**Likely fixes (apply only the ones the diagnosis confirms)**
- If no pg_cron job is scheduled: create one via migration:
  ```sql
  select cron.schedule(
    'commissioner-schedule-tick-every-minute',
    '* * * * *',
    $$ select net.http_post(
         url:='https://<project-ref>.functions.supabase.co/commissioner-schedule-tick',
         headers:=jsonb_build_object('Content-Type','application/json','apikey','<ANON_KEY>'),
         body:='{}'::jsonb
       ); $$
  );
  ```
- If the cron job exists but auth fails: the tick function already accepts the anon key — verify the cron's `apikey` header matches `SUPABASE_ANON_KEY`. Fix the cron body if needed.
- If schedule rows have wrong `run_time_lisbon` or `enabled=false`: surface clearer status in the UI (already shows toggle) — no code change needed unless data is wrong.
- After the fix: run a 1-minute window test (set `run_time_lisbon` to next minute, watch `last_run_at` update).

---

## Files to touch

- `supabase/functions/leagues-manage/index.ts` (extend)
- `src/pages/ScoringPage.tsx`, `src/pages/LeaguesPage.tsx`
- `src/components/court-show/CourtShowSlide.tsx`
- `src/components/ScheduleList.tsx` (+ any schedule row component)
- `src/pages/RosterPage.tsx` (remove banner)
- `src/pages/OnboardingPage.tsx`, `src/components/onboarding/DraftStep.tsx`, new `src/hooks/useOnboardingAudio.ts`
- `index.html`, `public/manifest.json` (or equivalent)
- New migration for `cron.schedule(...)` if pg_cron job missing.

No breaking DB schema changes. No favicon changes.
