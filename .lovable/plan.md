

## Plan: Send Matchup URL with the correct param shape

### Findings
Image-208 proves the URL that lands on the **Matchups** tab with both player chips active is:

```
https://www.nbaplaydb.com/search?defensivePlayers=Nikola%20Jokić&offensivePlayers=Neemias%20Queta
```

Our current `handleMatchupOpen` sends three params (`actionplayer` + `defensivePlayers` + `offensivePlayers`). NBAPlayDB sees `actionplayer` first, switches to the **Play Filters** tab, and silently drops the matchup params — that's why image-207 → image-206 lands on Play Filters with only `Actionplayer: Neemias Queta` chip.

### Fix — `src/pages/AdvancedPage.tsx` (`handleMatchupOpen`, ~line 200)

Drop `actionplayer` from the URL. Keep only the two matchup params:

```ts
const handleMatchupOpen = () => {
  const params = new URLSearchParams({
    defensivePlayers: defensivePlayer,
    offensivePlayers: offensivePlayer,
  });
  const url = `https://www.nbaplaydb.com/search?${params.toString()}`;
  window.open(url, "_blank");
  toast.success("Opening NBAPlayDB", {
    description: `Matchup: ${offensivePlayer} (off) vs ${defensivePlayer} (def).`,
  });
};
```

- Removes the `actionplayer` param that was forcing the Play Filters tab.
- Drops the clipboard copy + clipboard-related toast wording — no longer needed since both chips now hydrate directly from the URL (proven by image-208).
- Update the helper line under the selectors:
  `Both players auto-applied as Matchup filters on NBAPlayDB.`

### Files touched
- `src/pages/AdvancedPage.tsx`

### Verification
- `/advanced` → Player Matchup → Neemias Queta (off) + Nikola Jokić (def) → click `Open Matchup on NBAPlayDB` → opens `https://www.nbaplaydb.com/search?defensivePlayers=Nikola%20Joki%C4%87&offensivePlayers=Neemias%20Queta` → page loads on the **Matchups** tab with `Defensive Players: Nikola Jokić` and `Offensive Players: Neemias Queta` chips active (matches image-208 exactly, 3 results).

