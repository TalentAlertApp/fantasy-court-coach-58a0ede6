## 1. /commissioner — "Scheduled Daily Runs" not firing

### Diagnosis
- DB confirms both `commissioner_sync_schedules` rows are `enabled=true`, `run_time_lisbon=07:30`, but `last_run_at IS NULL` for both → cron has never successfully invoked the tick.
- `cron.job` row exists (`commissioner-schedule-tick`, `* * * * *`, active) and posts to `/functions/v1/commissioner-schedule-tick` with the **anon key** as Bearer.
- Edge logs show every minute: `POST | 401 | commissioner-schedule-tick`.
- Root cause: `commissioner-schedule-tick/index.ts › authorize()` accepts only `x-admin-secret` matching `ADMIN_API_SECRET`, OR Bearer token equal to `SUPABASE_SERVICE_ROLE_KEY`. The cron sends the anon key → 401 → schedules never run.

### Fix
Reschedule the existing cron via a `supabase--read_query`-style insert (using the user-data-aware insert tool, NOT a migration, because it embeds project-specific secrets) to send the Authorization Bearer = `SUPABASE_SERVICE_ROLE_KEY`. Keep the same job name (`commissioner-schedule-tick`), schedule (`* * * * *`), and URL.

Concretely:
```sql
select cron.unschedule('commissioner-schedule-tick');
select cron.schedule(
  'commissioner-schedule-tick',
  '* * * * *',
  $$ select net.http_post(
    url := 'https://jtewuekavaujgnynmpaq.supabase.co/functions/v1/commissioner-schedule-tick',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
    body := concat('{"t":"', now(), '"}')::jsonb
  ); $$
);
```
The service role key is already trusted by the function's `authorize()` path. No edge-function code change needed.

### Verification
- Wait one minute, then re-query `function_edge_logs` for `commissioner-schedule-tick` — expect 200s.
- At 07:30 Lisbon, `commissioner_sync_schedules.last_run_at` becomes non-null and `last_status='ok'`.
- Manual override (`?force=sync3` from the /commissioner panel) already works because it sends `x-admin-secret`.

## 2. /advanced › Play Search › By Game — gray-out unplayed games

In `src/pages/AdvancedPage.tsx` (TabsContent value="game"), the game `<SelectItem>` rows render away/home with normal colors regardless of `g.status`. Schedule rows expose `status` (`SCHEDULED` for unplayed, `FINAL` once finished — see `supabase/functions/schedule/index.ts`).

### Changes
- For each item in the `(gamesByDate ?? []).map(...)` block:
  - Compute `const isPlayed = g.status === "FINAL";` (treat anything not FINAL — `SCHEDULED`, `LIVE`, null — as "no plays available yet"; matches play-search reality where NBAPlayDB only has data after the game is final).
  - When not played, apply muted styling to the row contents: wrap the inner `<div>` with `className={... + (isPlayed ? "" : " opacity-50 grayscale")}` so logos desaturate and team names go muted, while keeping the row selectable (so users can still pick it and see it confirmed).
  - Also dim the tipoff time to `text-muted-foreground/70` for unplayed.
- Add a tiny inline hint pill on unplayed rows: `<span className="ml-auto text-[9px] uppercase tracking-wider text-muted-foreground/80">Not played</span>` appended after the tipoff string (or replacing the tipoff position when status is not FINAL — keep tip time visible for context).
- When the currently-selected `gameId` corresponds to an unplayed game, show a subtle helper line under the row of buttons: `"This game hasn't been played yet — no player actions to search."` styled `text-[10px] text-muted-foreground`. Buttons stay enabled (the user may still want to open the page on NBAPlayDB).

No data-layer / hook changes required — `status` already arrives from the schedule edge function.

## Files touched
- (DB only, no file) — reschedule the `commissioner-schedule-tick` pg_cron job to send the service-role key.
- `src/pages/AdvancedPage.tsx` — gray-out unplayed games in the By Game selector and add a helper hint.
