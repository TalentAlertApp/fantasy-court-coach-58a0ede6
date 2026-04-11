
Root cause confirmed:
- The strip is not missing because of bad data; it is blocked by a frontend logic bug.
- In `src/components/TopPlayersStrip.tsx`, completed games are filtered with `g.status === "Final"`.
- Live `schedule_games.status` values are uppercase (`FINAL`), so `finalGameIds` is always empty, the top-player query never runs, and the component always returns `null`.
- I verified live data exists: GW25 has FINAL games on days 1–4, and `player_game_logs` has non-zero FP rows for those games.

Implementation plan:

1. Fix completed-game detection in `src/components/TopPlayersStrip.tsx`
- Replace the exact status check with the same normalization pattern already used elsewhere in the app:
  - `const isFinalStatus = (status?: string) => (status ?? "").toUpperCase().includes("FINAL")`
- Build `finalGameIds` from games matching:
  - selected `day`
  - `isFinalStatus(g.status)`

2. Keep the strip hidden only when appropriate
- If `weekGames` is still loading, render nothing.
- If the selected day has zero final games, return `null`.
- If the selected day has final games, run the existing `player_game_logs` + `players` fetch and render the strip.

3. Keep the data strictly “top players from that day only”
- Continue querying `player_game_logs` using only the selected day’s final `game_id`s.
- Keep `fp > 0` so the strip never shows `0.0` players.
- Keep top 5 FC and top 5 BC based on actual game-day `fp`, not season averages.

4. Add one small robustness pass
- Guard formatting with `Number(p.fp ?? 0).toFixed(1)` even though the query already filters positive FP.
- Keep the current player-name click behavior that opens `PlayerModal`.

QA after implementation:
- Open `/schedule` on a completed day (for example GW25 day 4) and confirm the strip appears with non-zero FP values.
- Switch to a scheduled-only day (for example GW25 day 5 or day 6) and confirm the strip is hidden.
- Click a player name in the strip and confirm the Player Modal opens.

Files to update:
- `src/components/TopPlayersStrip.tsx`

No database changes are needed.
