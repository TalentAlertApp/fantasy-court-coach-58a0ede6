## Update "How To Play" modal for EuroLeague

Edit `src/components/HowToPlayModal.tsx` only. Make every section league-aware via `useLeague()` (NBA / WNBA / EuroLeague) instead of the current binary `isWnba` switch. Keep the same accordion structure and tone; only adjust copy where the league actually matters.

### Per-section changes

- **Header / LEAGUE label**: derive `LEAGUE` from `league` → `"NBA" | "WNBA" | "EuroLeague"` and use it everywhere a sport name appears.

- **Selecting Your Initial Roster**: keep $100M cap, 10 players (5 FC / 5 BC), 2-per-team rule. Replace "Maximum 2 players from the same NBA team" with the dynamic `LEAGUE` label so EuroLeague reads naturally.

- **Managing Your Team**: unchanged structurally; no league-specific copy here.

- **Deadlines**: keep 30-min-before-tipoff rule and Lisbon timezone. Add a one-liner noting that EuroLeague gamedays are typically Tue–Fri (vs. NBA/WNBA's denser nightly schedule) so users understand the gameweek shape — kept to a single short sentence to honor "simple and readable".

- **Leagues** (the accordion section): generalize the "(NBA or WNBA)" parenthetical to "(NBA, WNBA or EuroLeague)". Update the Create-a-League line to "set the sport (NBA, WNBA or EuroLeague)". Multi-team line stays the same.

- **Chips, Scoring, Indexes & Ballers.IQ, FAQ**: no copy changes needed — formulas and chip rules are league-agnostic. FAQ's "salaries updated periodically" line stays.

### Technical notes

- Replace `const LEAGUE = isWnba ? "WNBA" : "NBA";` with a small map:
  ```ts
  const LEAGUE = league === "wnba" ? "WNBA" : league === "euroleague" ? "EuroLeague" : "NBA";
  ```
- Pull `league` (not just `isWnba`) from `useLeague()`.
- No new imports, no schema changes, no other files touched.

### Out of scope

- No visual/layout redesign of the modal.
- No changes to scoring formulas, chip mechanics, or any business logic.
- No changes to other components that mention league names.
