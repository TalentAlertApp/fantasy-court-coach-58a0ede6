

## Plan: Add "How To Play" Guide Modal + Align Rules in Codebase

### What the images say (rules summary)
- Roster: 10 players (5 BC + 5 FC), salary cap $100M, max 2 per NBA team
- Formations: 2BC+3FC or 3BC+2FC (starters), bench provides auto-subs
- Scoring: PTS×1, REB×1, AST×2, BLK×3, STL×3
- Chips: Gameday Captain (1/week, doubles score), All-Star (once/season, unlimited budget), Wildcard (3/season, free transfers)
- Deadlines: 30 min before first tipoff each gameday
- Max 2 players from same NBA team

### Changes

**1. Create `src/components/HowToPlayModal.tsx`**
A dialog/modal containing the full guide content organized in collapsible accordion sections:
- Selecting Your Initial Roster (roster size, 5BC+5FC, salary cap $100M, max 2 per team)
- Managing Your Team (formations 2BC+3FC or 3BC+2FC, auto bench subs, bench priority)
- Deadlines (gameweeks/gamedays, 30 min before first tipoff)
- Chips (Gameday Captain, All-Star, Wildcard — with availability windows)
- Scoring (PTS×1, REB×1, AST×2, BLK×3, STL×3)
- FAQ (can I have more than one team, injury transfers, bench subs cascade)

Styled with yellow accordion headers matching the uploaded screenshots' aesthetic. Triggered by a `HelpCircle` icon button.

**2. Update `src/components/layout/AppLayout.tsx`**
- Add `HelpCircle` icon button at the far right of the header (inline with Commissioner nav area, but in the top navy header bar, after TeamSwitcher)
- Clicking opens the HowToPlayModal

**3. Enforce "max 2 players per NBA team" rule**
- **`src/components/PlayerPickerDialog.tsx`**: When filtering available players, grey out / disable players from teams that already have 2 players on the roster. Show a small tooltip "Max 2 per team".
- **`src/lib/optimizer.ts`**: No change needed (swaps don't change team composition)

**4. Verify existing constraints match rules**
- `starter_fc_min=2, starter_bc_min=2` already enforced — correct
- Salary cap $100 already used — correct
- Roster size 10 (5 starters + 5 bench) — already enforced

### Files

| File | Change |
|------|--------|
| `src/components/HowToPlayModal.tsx` | New — full guide modal with accordion sections |
| `src/components/layout/AppLayout.tsx` | Add HelpCircle icon in header, import/render modal |
| `src/components/PlayerPickerDialog.tsx` | Enforce max 2 players per NBA team rule |

### Implementation Order
1. Create HowToPlayModal component
2. Wire it into AppLayout header
3. Add max-2-per-team constraint to PlayerPickerDialog

