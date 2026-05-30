## 1) `/teams` header — logo after "Teams", remove dot

In `src/pages/TeamsPage.tsx`, change the `PageHeaderCaption` from `[league logo] · Teams Hub` to the new inline pattern `Teams [league logo] Hub` (no dot separator), mirroring `/advanced` and `/transactions`. The logo keeps the same size/opacity/hover-scale.

## 2) `/transactions` (`src/pages/PlayersPage.tsx`)

### a) Fix the flashing "Roster N/10" button
The mobile-only roster Sheet trigger renders when `!isWideScreen`. `useMediaQuery` (`src/hooks/useMediaQuery.ts`) starts as `false` and only corrects after its effect runs, so on wide screens the button briefly appears then disappears.

Fix in `useMediaQuery`: initialize state lazily from the real match instead of always `false`:

```text
useState<boolean>(() =>
  typeof window !== "undefined" && "matchMedia" in window
    ? window.matchMedia(query).matches
    : false
)
```

This makes `isWideScreen` correct on first render, so the Roster button no longer flashes on desktop. Keeps SSR-safe fallback.

### b) ALL-STAR button icon
Replace the `Sparkles` icon on the All-Star chip button with a context-appropriate `Star` icon (import `Star` from lucide-react; `Sparkles` import stays only if still used elsewhere — it is not, so it will be dropped).

## 3) `/schedule` LIVE day indicators (`src/pages/SchedulePage.tsx`)

### Problem
The day-rail red dot uses `isDayToday = wd.date === todayStr` (naive UTC calendar date). It advances to the next gameday (e.g. 4.5 / SAT 30) while the prior gameday's games (4.4 / FRI 29, last tip 03:00 Lisbon Sat) are still LIVE. There is also no live-game indicator.

### Add a live-days hook
Add `src/hooks/useScheduleWeekLive.ts` (small, mirrors `useScheduleWeekCounts`): query `schedule_games` filtered by `league_id` + current `gw`, selecting `day, status`. Return a `Set<number>` of `day` values that have at least one game whose status (uppercased) includes `LIVE` (and not `FINAL`). `staleTime` short (~30s) so it refreshes during live slates.

### Use it in the day rail
- Compute `liveDays` from the hook and `hasAnyLive = liveDays.size > 0`.
- Per day cell, compute:
  - `isLiveDay = liveDays.has(wd.day)`
  - `isCurrentDay = isLiveDay || (!hasAnyLive && wd.date === todayStr)`
- Render the red dot when `isCurrentDay` (replacing the current `isDayToday` condition). When `isLiveDay`, add `animate-pulse` to the dot so it visibly pulses next to the day label (e.g. FRI 29). Non-live current-day dot stays static.
- Keep the existing played-day `CircleCheckBig` logic, guarded by `!isCurrentDay` instead of `!isDayToday`.

### Effect
While 4.4 (FRI 29) still has LIVE games, the pulsing red dot stays on FRI 29 and the premature SAT 30 (4.5) calendar dot is suppressed. Once no games are live, behavior falls back to the calendar-today dot. NBA/WNBA/EuroLeague all share this rail, so all benefit.

## Files touched
- `src/pages/TeamsPage.tsx` — header caption
- `src/hooks/useMediaQuery.ts` — lazy initial match (fixes flash)
- `src/pages/PlayersPage.tsx` — ALL-STAR icon
- `src/hooks/useScheduleWeekLive.ts` — new hook
- `src/pages/SchedulePage.tsx` — live/pulsing day dot logic

## Verification
- `/teams`: caption reads `Teams [logo] Hub`, no dot.
- `/transactions` on desktop (≥1280px): no Roster button flash on load; All-Star button shows the new icon.
- `/schedule` during a live slate: pulsing red dot sits on the day with LIVE games (e.g. FRI 29), not on the next calendar day; reverts to calendar-today dot when nothing is live.
