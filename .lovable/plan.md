

## Plan: Fix Team Logo Matching + Add Logos to PlayerPickerDialog

### Problem
`core.team` contains city/short names (e.g., "Dallas", "Houston", "LA Lakers", "Golden State") but `getTeamLogo()` matches by 3-letter tricode (e.g., "DAL", "HOU", "LAL"). No logos ever match.

### Fix 1: Add fuzzy name lookup to `src/lib/nba-teams.ts`

Add a new function `getTeamLogoByName(name: string)` that matches against partial/short team names. Build a mapping of common short names to tricodes:

```
"Atlanta" → ATL, "Boston" → BOS, "Brooklyn" → BKN, "Charlotte" → CHA,
"Chicago" → CHI, "Cleveland" → CLE, "Dallas" → DAL, "Denver" → DEN,
"Detroit" → DET, "Golden State" → GSW, "Houston" → HOU, "Indiana" → IND,
"LA Clippers" → LAC, "LA Lakers" → LAL, "Memphis" → MEM, "Miami" → MIA,
"Milwaukee" → MIL, "Minnesota" → MIN, "New Orleans" → NOP,
"New York" → NYK, "Oklahoma" → OKC, "Orlando" → ORL,
"Philadelphia" → PHI, "Phoenix" → PHX, "Portland" → POR,
"Sacramento" → SAC, "San Antonio" → SAS, "Toronto" → TOR,
"Utah" → UTA, "Washington" → WAS
```

Update `getTeamLogo(teamStr)` to try tricode match first, then fall back to name match. This fixes all existing call sites without changing them.

### Fix 2: Add logos to `PlayerPickerDialog.tsx`

Import `getTeamLogo` and add a small team logo icon (w-5 h-5) next to the team name in each player row, same pattern as `PlayerRow.tsx`.

### Files Modified (2)
- `src/lib/nba-teams.ts` — add name-to-tricode map, update `getTeamLogo` to support both tricodes and city names
- `src/components/PlayerPickerDialog.tsx` — import `getTeamLogo`, add logo icon next to team name

