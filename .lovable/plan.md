## Plan

1. **Transactions Players table layout**
   - Update the Team column so contextual icons sit **to the left of the team logo/code**.
   - Reserve a fixed icon lane wide enough for the max visible icons (`max=3` plus overflow count), aligned to the **right edge of that lane**.
   - Keep the team logo/code in a separate fixed area so icons cannot overlap it.

2. **Expose the actual Schedule sync error**
   - Improve `/commissioner` WNBA sync results so the red `errors: 1` can be expanded/read directly instead of only showing a count.
   - Add enough diagnostic detail to identify the failing batch/row when Schedule sync partially succeeds.

3. **Fix WNBA live scores from Schedule sync**
   - The database currently still has only `FINAL` and `SCHEDULED` WNBA schedule rows after the sync; the live rows in the sheet are not reaching `schedule_games`.
   - The most likely remaining issue is the schedule upsert conflict target: `schedule_games` primary key is only `game_id`, while the sync now sends `league_id` too. I will adjust the WNBA schedule sync so it updates existing game IDs safely and preserves the live status strings/scores (`Q4 5:03`, `Half`, etc.).
   - Verify after the change by checking the specific live game IDs (`1022600049`, `1022600050`) in `schedule_games` and confirming scores/status can update.

## Notes

- `upserted: 130` with `read: 330` means one 200-row batch failed and one 130-row batch succeeded. That is why not all 330 sheet rows landed.
- The app only shows `errors: 1` today because the Commissioner panel counts errors but does not display the error text; I will make that visible as part of the fix.