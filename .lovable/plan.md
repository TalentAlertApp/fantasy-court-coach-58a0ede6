## Goal

Polish the Ballers.IQ → Player Explain cards and rework the /transactions "Bring In" entry points into a single premium search card, plus add a deselect-all icon to the Market Status filter.

---

## 1. Player Explain — "generating" card (while searching)

File: `src/components/ballers-iq/PlayerExplainStudio.tsx` (loading state, ~lines 173–234)

- Add `useLeague` and apply the same EuroLeague photo framing used elsewhere: the round photo gets `object-top` for EuroLeague, `object-[center_15%]` otherwise.
- Remove the small inline team-badge logo shown next to the team name (~line 201).
- Promote the team badge into a large watermark in the **top-right corner** of the generating `GlassPanel` — faint, rotated, `group-hover` surge (scale + opacity), matching the result card / Bring In modal watermark pattern. Add `group relative overflow-hidden` to the panel.

## 2. Player Explain — result card (after search)

File: `src/components/ballers-iq/ExplainReport.tsx` (hero, ~lines 133–222)

- Add a **5th context-sensitive tile** next to FP5 / FP Season / BIQ / Verdict showing **Salary + Value**:
  - Salary: `player.core.salary` → `$XXM`.
  - Value: `player.last5?.value5` (FP per $M) when present, else hidden/`—`.
  - Same tile styling (rounded, bordered, centered label + mono value, `min-h-[58px]`).
- Rebalance the hero grid so all elements spread evenly across the card width: give the player block slightly less width and the stat strip room for 5 tiles (e.g. player `md:col-span-3`, stats `md:col-span-9` with `md:grid-cols-5`), keeping responsive 2-col stacking on mobile.

## 3. /transactions — Market Status deselect-all icon

File: `src/components/transactions/BadgeFilter.tsx`

- Replace the text "Clear" at the filter's top-right with an **icon button** (lucide `FilterX`) meaning "deselect all".
- Tooltip "Deselect all"; visible only when at least one badge is selected; `onClick` clears selection (`onChange([])`). Keep it visually consistent (muted → hover foreground, small icon).

## 4. /transactions — remove per-row crosshair, add premium Bring In search card

File: `src/pages/PlayersPage.tsx`

- **Remove** the per-row Crosshair "Bring In" button (~lines 1015–1024). Keep the `+` stage-in button and status dot.
- Add a **premium "Bring In a Target" card above the Available Players table** (inside the center column, above the table header):
  - Editorial styling consistent with the page (rounded-2xl, subtle gradient/border, NBA accent, Crosshair icon + short label like "Search any player and see how they fit your roster").
  - Inline search input (diacritic-insensitive, per project rule) with a dropdown of matching players (photo, name, team logo, FC/BC, salary, FP5) — mirror the existing Player Explain dropdown styling.
  - Selecting a player sets `bringInTargetId` and opens the existing `BringInModal` (already wired at the bottom of the page) for that target. No commit — staging only, as today.
- Keep existing `openBringIn`/`bringInTarget`/`BringInModal` plumbing; just drive it from the new card instead of per-row icons. Existing `?bringIn&outs&ins` staging flow is unchanged.

---

## Technical notes

- EuroLeague framing: reuse the `useLeague()` + conditional `object-*` pattern already in `ExplainReport.tsx` (line ~145) and `BringInModal.tsx`.
- Watermark pattern: reuse the absolute, low-opacity, rotated `<img>` with `group-hover:opacity-* group-hover:scale-110` (as in `ExplainReport` hero and `BringInModal` header).
- Diacritic-insensitive search already exists on the page (`search` lowercased filter at ~line 536); reuse/extend the same normalization for the new card's matches.
- No changes to scoring, salary cap, FC/BC, max-2-team, or GW transfer-cap logic. The Bring In modal continues to only stage/preview.

## Files touched

- `src/components/ballers-iq/PlayerExplainStudio.tsx`
- `src/components/ballers-iq/ExplainReport.tsx`
- `src/components/transactions/BadgeFilter.tsx`
- `src/pages/PlayersPage.tsx`
