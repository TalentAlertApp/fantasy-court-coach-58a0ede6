

## Plan: Game-day arrows + working Matchup pre-fill

### 1. `/advanced` → By Game: prev/next day navigation arrows
File: `src/pages/AdvancedPage.tsx` (Game date cell, ~line 258-261)

Wrap the date `<Input>` with two compact icon buttons so the user can step day-by-day without opening the native date picker.

- Layout (replacing the current single-input cell):
  ```tsx
  <div className="space-y-1.5">
    <Label …>Game date</Label>
    <div className="flex items-stretch gap-1">
      <Button variant="outline" size="icon" className="h-10 w-9 rounded-lg shrink-0"
              onClick={() => shiftDate(-1)} aria-label="Previous day">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Input type="date" value={date} onChange={…} className="rounded-lg flex-1 min-w-0" />
      <Button variant="outline" size="icon" className="h-10 w-9 rounded-lg shrink-0"
              onClick={() => shiftDate(1)} aria-label="Next day">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  </div>
  ```
- Helper inside the component:
  ```ts
  const shiftDate = (delta: number) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  };
  ```
- Bump the column width: `grid sm:grid-cols-[180px_1fr_auto]` → `grid sm:grid-cols-[230px_1fr_auto]` so the two arrows + input fit cleanly without squeezing the Game select.
- Add `ChevronLeft, ChevronRight` to the existing `lucide-react` import.
- The existing date-change handler already triggers a refetch + clears `gameId`, so the arrows automatically reload the games list.

### 2. `/advanced` → Player Matchup: actually pre-select both players on NBAPlayDB

The current URL `?defensivePlayers=…&offensivePlayers=…` lands on the Matchups tab (good) but with empty player dropdowns (bad) — NBAPlayDB's Matchups panel hydrates from a different param shape than what we're sending. Per the screenshot evidence and the only verified working filter param on that site (`actionplayer`), the practical fix is:

- Open the URL with the `actionplayer` param (which IS recognized as an Active Filter chip) AND keep our `defensivePlayers` / `offensivePlayers` params as a hint for any future-compatible hydration:
  ```ts
  const url =
    `https://www.nbaplaydb.com/search` +
    `?actionplayer=${encodeURIComponent(offensivePlayer)}` +
    `&defensivePlayers=${encodeURIComponent(defensivePlayer)}` +
    `&offensivePlayers=${encodeURIComponent(offensivePlayer)}`;
  ```
  This guarantees the offensive player shows as an Active Filter chip immediately, while still flagging the defender for Matchups-aware logic. The previous attempt that dropped `actionplayer` proved the matchups-only params are silently ignored on landing.
- After opening the URL, copy the defender's full name to the user's clipboard (so they can paste it into the Matchups → Defensive Player dropdown in one move) and show a toast:
  ```ts
  await navigator.clipboard?.writeText(defensivePlayer);
  toast({
    title: "Opening NBAPlayDB",
    description: `Offensive filter applied for ${offensivePlayer}. Defender "${defensivePlayer}" copied to clipboard — paste into the Matchups → Defensive Player field.`,
  });
  ```
  Use the existing `useToast` hook (`@/hooks/use-toast`, already used elsewhere in the project).
- Update the helper line under the selectors to match:
  `Offensive player auto-applied as filter. Defender name copied to clipboard for one-paste selection.`

This delivers the closest behavior NBAPlayDB allows today (their Matchups tab does not appear to hydrate from URL params for the player selects; copying the name to the clipboard removes the friction of re-typing).

### Files touched
- `src/pages/AdvancedPage.tsx` — add `ChevronLeft/ChevronRight` arrows around the date input with a `shiftDate` helper; widen the date column; rewrite the matchup `onClick` to include `actionplayer` + clipboard copy + toast; tweak the helper sentence.

### Verification
- `/advanced` → By Game: pick `2026-04-12` → click left arrow → date becomes `2026-04-11`, the Game select reloads with that day's games and clears any prior selection. Right arrow advances back. Both arrows live next to the date input, fit on one row at 1318px.
- `/advanced` → Player Matchup: pick `Luka Dončić` (off) and `Anthony Edwards` (def) → click `Open Matchup on NBAPlayDB` → opens NBAPlayDB on the Matchups tab with **`Actionplayer: Luka Dončić`** chip in Active Filters, the defender's name `Anthony Edwards` is on the clipboard, and a toast says so. One paste into the Defensive Player dropdown completes the matchup.

