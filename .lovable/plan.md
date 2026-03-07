

## Plan: Expand Schedule Calendar to Full Regular Season (GW 1–25)

### What Changes

**Single file: `src/pages/SchedulePage.tsx`**

1. **Expand CALENDAR** — Add all gameweek/day entries from GW1 (Oct 22, 2025) through GW20 (Mar 8, 2026), keeping existing GW21–25 entries. Some dates map to two game-days (e.g., GW1-D1 and D2 both on Oct 22); the later day overwrites in the Record, which is acceptable since the lookup is only for initial page load.

2. **Add DAYS_IN_WEEK map** — Not all weeks have 7 days (GW1=6, GW6=6, GW9=6, GW10=6, GW17=4, GW18=4). Add a lookup so the day +/- navigation respects the actual max day per week instead of always capping at 7.

3. **Update MIN_WEEK** — Change from 21 to 1.

4. **Update `changeDay`** — Use `DAYS_IN_WEEK[gw]` for the upper bound instead of hardcoded 7. When wrapping to a previous week, set day to that week's max day.

5. **Update disabled logic** — Day forward button disabled when `day >= DAYS_IN_WEEK[gw] && gw >= MAX_WEEK`.

### Full Date-to-Week/Day Mapping

Derived from the provided deadlines (date = game date):

| GW | Days | Dates (YYYY-MM-DD) |
|---|---|---|
| 1 | 6 | Oct 22, 22, 24, 25, 25, 26 |
| 2 | 7 | Oct 27–31, Nov 1–2 |
| 3 | 7 | Nov 3, 5, 5, 7, 7, 8, 9 |
| 4 | 7 | Nov 10, 12, 12, 13, 14, 15, 16 |
| 5 | 7 | Nov 17–23 |
| 6 | 6 | Nov 24, 25, 26, 29, 29, 30 |
| 7 | 7 | Dec 1–7 |
| 8 | 7 | Dec 8, 9, 11, 12, 12, 13, 14 |
| 9 | 6 | Dec 15, 18, 18, 19, 20, 21 |
| 10 | 6 | Dec 22, 23, 25, 26, 27, 28 |
| 11 | 7 | Dec 29, 31, 31, Jan 1, 2, 3, 4 |
| 12 | 7 | Jan 5–11 |
| 13 | 7 | Jan 12, 14, 14, 15, 16, 17, 18 |
| 14 | 7 | Jan 19–25 |
| 15 | 7 | Jan 26–31, Feb 1 |
| 16 | 7 | Feb 2–5, 7, 7, 8 |
| 17 | 4 | Feb 9, 11, 11, 13 |
| 18 | 4 | Feb 19–22 |
| 19 | 7 | Feb 23, 24, 26, 26, 27, 28, Mar 1 |
| 20 | 7 | Mar 2–8 |
| 21–25 | existing | already in code |

### No Other Files Affected

The schedule edge function and `ScheduleList` component need no changes — they already handle arbitrary gw/day values.

