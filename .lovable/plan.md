## Plan

1. **Unify live-game detection**
   - Update `useScheduleWeekLive` so it selects `day`, `status`, and `tipoff_utc`.
   - Treat a game as live using the same rules already used by `ScheduleList`: real live statuses (`LIVE`, `IN_PROGRESS`, `Q1`, `HALF`, `OT`, etc.) OR scheduled games whose tipoff has passed and are still inside the live window, excluding finals.
   - This fixes the actual bug shown in the screenshot: the cards are LIVE via tipoff-window logic, but the day rail hook only checked `status`, so it missed day `4` and fell back to Saturday.

2. **Make fallback date comparison Lisbon-aware**
   - Replace `new Date().toISOString().slice(0, 10)` in `SchedulePage` with a Europe/Lisbon `YYYY-MM-DD` formatter.
   - Use this only when no games are considered live.

3. **Keep the day rail stable while games cross midnight**
   - When any games are live in the selected GW, show the pulsing red dot only on those actual live `day` values.
   - Do not let the calendar fallback mark `SAT 30 / 4.5` while `FRI 29 / 4.4` games are still in the live window.

4. **Reduce drift between hook and UI cards**
   - Extract or duplicate the tiny live-status predicate consistently so both schedule cards and the day rail interpret statuses the same way.
   - Keep frequent refetching so the dot moves after the live window/final statuses change.