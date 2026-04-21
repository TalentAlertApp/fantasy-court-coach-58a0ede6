

## Plan: Match /schedule's game list, fix next-day arrow, harden Matchup link

### Issue 1a — By Game shows wrong date's games

Root cause: AdvancedPage queries `schedule_games` by `tipoff_utc` between `[date 00:00 UTC, +24h)`. NBA games with Lisbon-evening tipoffs (e.g. Apr 12 22:30 Lisbon) are stored as UTC `01:30` of Apr 13, so they fall into the **next** UTC bucket. That's why selecting `12/04/2026` listed Apr 13 games (image-209 vs image-210).

Fix — switch the picker from a calendar date to the `gw/day` model the rest of the app uses (SchedulePage, deadlines.ts).

File: `src/pages/AdvancedPage.tsx`

- Replace `date` state with `gw` + `day` state, initialized from `getCurrentGameday()` (already used by SchedulePage).
- Replace the `<Input type="date">` cell with a compact two-select control: **GW** select (1–25) + **Day** select (1..N for that GW, derived from `DEADLINES.filter(d => d.gw === gw)`).
- Show the Lisbon date label next to the selects (e.g. `Sun, Apr 12`) computed from the deadline lookup, so the user still sees the calendar day.
- Replace the query with the same shape SchedulePage uses — fetch from `schedule_games` by `gw=<gw>&day=<day>`:
  ```ts
  supabase.from("schedule_games")
    .select("game_id, away_team, home_team, tipoff_utc, status")
    .eq("gw", gw).eq("day", day)
    .order("tipoff_utc", { ascending: true });
  ```
- Derive `yyyymmdd` for the NBAPlayDB URL from the matched deadline's date (Lisbon day), not from a UTC-coerced field, so the gamecode (e.g. `20260412/ORLBOS`) matches the displayed Lisbon date.

### Issue 1b — Right-arrow not advancing

Two bugs:
1. `useMemo(() => { setGameId(""); }, [date])` calls a setter inside `useMemo` — React's render-phase rule violation, the side effect fires inconsistently and is the reason the right arrow appears dead while the left works (the second click can short-circuit). Move the reset into `useEffect`.
2. Switching to gw/day means arrows now step through `DEADLINES` — implement `shiftDay(+1)` / `shiftDay(-1)`:
   - Build the ordered list `DEADLINES` (already chronological).
   - Find current index by `(gw, day)`; arrow moves to neighbor's `(gw, day)`.
   - Disable left arrow at first deadline, right arrow at last.
- Wire arrows around the GW/Day controls, same borderless ghost styling as today.

### Issue 2 — Matchup URL converted to bare `/search`

NBAPlayDB's client app appears to strip unknown/unmatched query params on landing. Two pragmatic improvements (we can't change their server):

File: `src/pages/AdvancedPage.tsx` (`handleMatchupOpen`)

1. **Open URL synchronously with `target="_blank"` link click** instead of `window.open`. Some Chrome/Edge configs treat `window.open(url, "_blank")` from a handler that also touches state as a popup the SPA strips on hydration. Build an `<a>` with `href`, `target="_blank"`, `rel="noopener"`, and `.click()` it:
   ```ts
   const a = document.createElement("a");
   a.href = url; a.target = "_blank"; a.rel = "noopener,noreferrer";
   document.body.appendChild(a); a.click(); a.remove();
   ```
2. **Copy the URL to the clipboard** as a guaranteed fallback, and update the toast:
   ```ts
   navigator.clipboard?.writeText(url).catch(() => {});
   toast.success("Opening NBAPlayDB", {
     description: `Matchup URL copied to clipboard. If filters don't apply, paste it into the address bar.`,
     duration: 6000,
   });
   ```
3. Keep the URL exactly as proven-working in image-208:
   `https://www.nbaplaydb.com/search?defensivePlayers=<def>&offensivePlayers=<off>` (no `actionplayer`, no extra params).

### Files touched
- `src/pages/AdvancedPage.tsx`

### Verification
- `/advanced` → By Game → set **GW 25 / Day 6** → Lisbon label shows `Sun, Apr 12` → game dropdown lists exactly the 7 games from image-210 (ORL@BOS, WAS@CLE, DET@IND, ATL@MIA, CHA@NYK, MIL@PHI, BKN@TOR), in tipoff order.
- Right arrow advances to **GW 25 / Day 7** (or next valid deadline) and the games list reloads; left arrow steps back. Both disabled at season boundaries.
- Pick `Orlando Magic @ Boston Celtics` → `Open Game on NBAPlayDB` opens `…/games/20260412-ORLBOS`; gamecode badge shows `20260412/ORLBOS`.
- Player Matchup → Anthony Edwards (off) + Aaron Gordon (def) → click opens `https://www.nbaplaydb.com/search?defensivePlayers=Aaron+Gordon&offensivePlayers=Anthony+Edwards` via anchor click; toast confirms URL is on clipboard so the user can paste if NBAPlayDB strips it.

