

## Plan: Replace "Player Matchup" with "Player Action" search

### Why
Image-212 proves the URL `?actionplayer=Neemias%20Queta&actiontype=rebound&actiontype=2pt` works perfectly on NBAPlayDB (lands on Play Filters with Actionplayer + multiple Actiontype chips active, 1,856 results). The Matchup URL keeps getting stripped by NBAPlayDB's hydration — abandon it and ship the Player Action variant instead.

### File touched
`src/pages/AdvancedPage.tsx` — `NBAPlaySearchSection`

### 1. Replace tab label and state
- Rename tab `matchup` → `action` and label `🏀 Player Matchup` → `🏀 Player Action`. Keep By Game tab as-is.
- Replace state `offensivePlayer` / `defensivePlayer` with:
  - `actionPlayer: string` (single player name)
  - `actionTypes: string[]` (multi-select; empty = "All")

### 2. Action Type catalogue
Constant inside the component:
```ts
const ACTION_TYPES = [
  { value: "rebound",  label: "Rebound" },
  { value: "2pt",      label: "2pt" },
  { value: "3pt",      label: "3pt" },
  { value: "freethrow",label: "Free Throw" },
  { value: "block",    label: "Block" },
  { value: "steal",    label: "Steal" },
  { value: "foul",     label: "Foul" },
  { value: "turnover", label: "Turnover" },
  { value: "violation",label: "Violation" },
  { value: "jumpball", label: "Jumpball" },
];
```

### 3. UI layout (Player Action tab)
Three-column row, same shell as the previous Matchup tab so the rest of the section is unchanged:

```text
[ Player (combobox)        ] [ Action Type (multi-popover) ] [ Open · Clear ]
```

- **Player**: reuse existing `PlayerCombobox` with `value={actionPlayer}` and label "Player".
- **Action Type**: Popover + Command list with checkbox items. Trigger button shows:
  - `All actions` when `actionTypes.length === 0`
  - First label + `+N` chip when multiple selected (e.g. `Rebound +2`)
  - Single label when exactly one
  Each Command item toggles its value in/out of `actionTypes`. Add a "Clear actions" footer item that empties the array.
- **Buttons**:
  - `Open Plays on NBAPlayDB` — disabled when `!actionPlayer`.
  - Ghost `Clear` — resets `actionPlayer = ""` and `actionTypes = []`.
- Helper line beneath: `Player + selected action types open as Play Filters on NBAPlayDB.`

### 4. URL construction
```ts
const handleActionOpen = () => {
  const params = new URLSearchParams();
  params.set("actionplayer", actionPlayer);
  for (const t of actionTypes) params.append("actiontype", t); // repeats the key
  const url = `https://www.nbaplaydb.com/search?${params.toString()}`;
  const a = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener,noreferrer";
  document.body.appendChild(a); a.click(); a.remove();
  toast.success("Opening NBAPlayDB", {
    description: actionTypes.length
      ? `${actionPlayer} · ${actionTypes.join(", ")}`
      : `${actionPlayer} · All actions`,
  });
};
```
- `URLSearchParams.append` produces the exact repeated-key shape the user verified (`?actionplayer=…&actiontype=rebound&actiontype=2pt`).
- Encoding handles diacritics automatically (Queta, Dončić, Šengün).

### 5. Remove obsolete code
- Delete `handleMatchupOpen`, `matchupDisabled`, the matchup clipboard fallback, and the unused `defensivePlayer` state.
- Keep By Game tab and all its logic (gameday selectors, arrows, NBAPlayDB game URL) untouched.

### Verification
- `/advanced` → Player Action tab → pick `Neemias Queta` → leave actions empty → `Open Plays on NBAPlayDB` opens `https://www.nbaplaydb.com/search?actionplayer=Neemias%20Queta` (Active Filters chip: `Actionplayer: Neemias Queta`).
- Same player → check `Rebound` + `2pt` → opens `https://www.nbaplaydb.com/search?actionplayer=Neemias%20Queta&actiontype=rebound&actiontype=2pt` (matches image-212 exactly: 1,856 results, both action chips active).
- Trigger button reads `Rebound +1`; multi-popover lets the user toggle any of the 10 action types.
- By Game tab continues to work exactly as today.

