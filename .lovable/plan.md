# Transactions polish + WNBA arena fix

Three independent fixes across the Transactions (Trade Center) page, the Market Status filter, and the WNBA standings venue table.

## 1) Inline the "Bring In a Target" search into the workbench row

Today the premium "Bring In a Target" card sits as its own bordered block above the Available Players table (center column), which pushes the table down so it no longer aligns with the MY ROSTER pane. The empty-state workbench shows an amber "Pick at least 1 player to release" prompt.

Changes:

- **`BringInSearchCard.tsx`** — add an `inline` (compact) mode:
  - Drops the outer rounded card chrome (border, gradient background, top hairline, padding block).
  - Renders just: the small crosshair icon, a short label ("Bring In"), and a compact search `Input` (height `h-8` to match the metric pills, width roughly `w-56`–`sm:w-64`).
  - Keeps the existing Popover results dropdown, diacritic-insensitive matching, keyboard handling, and `onSelect` behavior unchanged.
  - The full bordered card stays available for any other caller via the default (non-inline) mode.

- **`TradeWorkbench.tsx`** — accept a new optional `bringInSlot?: ReactNode` prop and render it inside Row 1 (the metrics row). When nothing is staged (`!hasChips` and not direct-add), show `bringInSlot` in place of the "Pick a player to release / add" prompt pill. When players are staged, keep the existing Valid / warning status pill so the user still gets validation feedback while building a trade. Size the slot to the row height so it reads as part of the toolbar.

- **`PlayersPage.tsx`**:
  - Pass `bringInSlot={<BringInSearchCard inline players={…} onSelect={openBringIn} />}` into `TradeWorkbench`.
  - Remove the standalone `<BringInSearchCard … />` that currently sits between the Trade Report and the table in the center column. With it gone, the Available Players table's top edge aligns with the MY ROSTER pane header again.

No change to staging/commit logic: selecting a player still calls `openBringIn` → opens `BringInModal` (preview/stage only).

## 2) Market Status deselect-all icon not visible

In `BadgeFilter.tsx` the `FilterX` deselect-all button is only rendered when `value.length > 0`, so in the default (nothing selected) state it is invisible — which is why it appears missing.

Change: always render the `FilterX` icon button in the top-right of the "Market Status" header. When no badge is selected, render it disabled/dimmed (reduced opacity, `cursor-default`, no hover surge); when one or more are selected, it is fully active and clears the selection on click. Tooltip "Deselect all" stays.

## 3) WNBA Atlanta arena image missing + table stability

Root cause: in `wnba-teams.ts` the Atlanta Dream `venueImage` is a Wikipedia **article** URL (`…/wiki/Gateway_Center_Arena#/media/File:…`), not a direct image file, so it never renders (and the row's `onError` hides it). Every other WNBA team uses a direct image URL.

Changes:

- **`wnba-teams.ts`** — replace the Atlanta `venueImage` with the verified direct Wikimedia file URL: `https://upload.wikimedia.org/wikipedia/commons/1/11/Gateway_Center_Arena%2C_at_night.jpg` (confirmed `200 image/jpeg`).
- **`LeagueStandingsWithVenue.tsx`** (stability) — add `decoding="async"` to the venue `<img>` and a `bg-muted/40` placeholder on the arena cell so the image fades in cleanly instead of flashing/jumping while loading. Rows already key on `tricode`, so re-sorts reuse DOM nodes and won't reload images; no data-fetch changes needed (standings query already has a 60s `staleTime` and no polling).

## Technical notes / files touched

- `src/components/transactions/BringInSearchCard.tsx` — add `inline` prop + compact rendering.
- `src/components/transactions/TradeWorkbench.tsx` — add `bringInSlot` prop; show it in Row 1 empty state.
- `src/pages/PlayersPage.tsx` — wire `bringInSlot`, remove standalone card above table.
- `src/components/transactions/BadgeFilter.tsx` — always render `FilterX`, disabled when nothing selected.
- `src/lib/wnba-teams.ts` — fix Atlanta `venueImage` URL.
- `src/components/standings/LeagueStandingsWithVenue.tsx` — image `decoding` + placeholder for smooth load.

Scope is presentation-only; no scoring, salary cap, FC/BC, max-2-team, or GW-cap rules change.