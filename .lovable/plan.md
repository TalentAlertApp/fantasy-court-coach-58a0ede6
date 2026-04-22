

## Player Picker — UX polish + schedule preview

Five focused changes to `src/components/PlayerPickerDialog.tsx` (+ small additions in `DraftPicker.tsx` and a new schedule mini-component).

### 0. Hover team badge → replace the player photo (CourtSlot)

Currently the team logo appears as a small chip in the bottom-left corner on hover. Move it so that on hover, the **team logo replaces the player photo** at the exact same size and position, no container, no border, no background.

- Keep player name / FC-BC chip / salary unchanged below.
- Crossfade between photo and logo (~180ms) using opacity. Logo sits absolutely on top of the photo, sized `aspect-square w-full object-contain`.
- Remove the existing `-bottom-1 -left-1` badge entirely.
- Tooltip: `title={player.core.team}` on the wrapper.

### 1. Inline warning when FC or BC group is full

Below the search row in the left column, render a small warning banner that appears only when `fcPicked >= 5` or `bcPicked >= 5` (and we're not yet at 10/10):

```
⚠ FC slots full (5/5) — pick BC players to complete your roster
```

- Red-tinted background (`bg-destructive/10 border-destructive/40 text-destructive`), rounded, `text-[11px] uppercase tracking-wider`, `px-3 py-2`.
- If both FC and BC are full → suppress (the 10/10 confirm CTA already covers that state).
- If the user has the FC or BC filter active and that group is full, sharpen the message: "FC filter active — all FC slots already filled. Switch to BC."

### 2. Confirm prompt when removing a picked player

The X button on each `CourtSlot` currently removes instantly. Add a confirmation:

- Use shadcn `AlertDialog` (already in the project).
- Click X → opens an alert: "Remove {Player Name}? You'll free ${salary}M and one {FC/BC} slot."
- Buttons: Cancel (default) / Remove (destructive).
- State lives in `PlayerPickerDialog` (`pendingRemoveId`) so we don't re-render every slot with its own dialog instance — a single `AlertDialog` rendered at the panel root, fed by the pending player.

### 3. Team filter dropdown next to the search box

Inline with the search input, add a compact team `Select` (shadcn) so the user can narrow to a specific NBA team.

- Layout: search input + team Select sit on the same row using `grid grid-cols-[1fr_140px] gap-2`.
- Options: "All Teams" + every unique tricode present in `allPlayers`, sorted alphabetically.
- Apply the team filter inside the existing `available` `useMemo`.
- Helper chip below the row when active: shows the selected tricode with an X to clear, plus a tiny "still need 3 FC / 2 BC" counter to make the cross-reference obvious.
- Bonus: when a team filter is active and `teamCounts[team] >= 2`, show "MAX 2 reached for {TEAM}" inside the warning slot from item 1.

### 4. Schedule day / GW selector with matchup preview

A new collapsible **"Schedule preview"** section at the bottom of the right (court) panel — only shown when `showCourtPreview` is true.

- Header strip with a left/right arrow GW selector (`◀  GW 12  ▶`) defaulting to current GW from `getCurrentGameday()`.
- Day chips below it: `D1 D2 D3 D4 D5 D6 D7` (only the days with games), highlighting the active one.
- Below: a compact 2-column list of matchups for the selected GW+day:
  ```
  LAL @ DEN   8:30 PM
  MIA @ BOS   7:00 PM
  ```
  Tricodes use `getTeamLogo` for tiny 16px logos. Tip-off in user's local time.
- Source: reuse the existing `useScheduleWeekGames(gw)` hook — already paginated by GW, then group by `day` client-side.
- Highlight rows where either team appears in `rosterTeams` with a yellow left border (so you instantly see which matchups affect your current picks).
- Collapsible (`Collapsible` from shadcn), default collapsed to keep the court breathing room.
- Trigger label: "Schedule · GW{n}" with chevron.

### Files touched
- `src/components/PlayerPickerDialog.tsx` — items 0, 1, 2, 3, and the schedule preview shell.
- `src/components/onboarding/DraftPicker.tsx` — pass current GW to the picker so the schedule preview defaults correctly (one prop addition).
- New tiny child component `SchedulePreview` defined inside `PlayerPickerDialog.tsx` (no new file unless it exceeds ~80 lines).

### Outcome
- No more accidental over-picks, no silent rejects, clear feedback when a slot group is full.
- Removing a player requires a deliberate click, preventing drag-by-mistake losses.
- Team filter + matchup preview let you plan with the schedule in view, never leaving the picker.
- Hovering a player swaps the photo for the team logo — clean, no extra chrome.

