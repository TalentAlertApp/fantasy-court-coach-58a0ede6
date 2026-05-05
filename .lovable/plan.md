# Implementation Plan

## 1) /teams — Standings tab

**a) Inline filter toggles next to "Standings"**
- `src/pages/TeamsPage.tsx`: Render the `StandingsFilters` (League / Conference / Division ToggleGroup) inline to the right of the "Standings" tab title row instead of stacked above the table. Lift the `view` state from `StandingsPanel` up to the page (or expose via prop), pass current `view` + `onChange` into a header row above the table.
- `StandingsPanel.tsx`: Accept `view` and `onChange` as optional props; if provided, do not render its own `StandingsFilters` (filters are rendered in the page header). Standings table fills the recovered vertical space.

**b) Ballers.IQ standings cards pinned to bottom**
- In `TeamsPage.tsx`, the Standings tab content is already a flex column with `h-[calc(100vh-220px)]`. Ensure the BIQ insights card sits at the bottom (`mt-auto`) and standings list is `flex-1 overflow-auto`.
- `BallersIQCard.tsx`: change the wordmark watermark to **emblem** (`ballers-iq-emblem-light.png`), using the same style as `LineupAdvisorPanel` (top-right, oversized, rotated, transparent, opacity ~0.18). Apply to both light + dark by using `forceTheme="light" transparent`.
- The top-left icon already uses emblem; ensure `transparent` flag is on so it embeds into card background in both themes.

## 2) /scoring — Recap Story
- `BallersIQCard.tsx` covers the icon transparency change globally (used by recap cards too).
- Watermark change in `BallersIQCard.tsx` from wordmark to emblem (per step 1b) covers "remove wordmark" + introduces emblem.
  - But step 2b says **remove** watermark from the 3 inner cards while step 1b says replace it. Resolution: add a `watermark` prop on `BallersIQCard` (`"emblem" | "none"`, default `"emblem"`). In `BallersIQRecapBlock.tsx`, pass `watermark="none"` to the 3 inner cards.
- `BallersIQRecapBlock.tsx`: add a top-right oversized rotated transparent **emblem** watermark on the outer "Recap Story" card (mirror `LineupAdvisorPanel` style).

## 3) /MY ROSTER — List view, Lineup Advisor
- `LineupAdvisorPanel.tsx`: keep its emblem watermark on the outer card (already present).
- Inner Captain Edge / Lineup Pulse cards: pass `watermark="none"` to `BallersIQCard` (re-uses prop from §2).
- Icon transparency: already emblem; ensure `transparent` so it embeds into background.

## 4) AI Coach empty state
- `src/components/AICoachModal.tsx`: in the empty state branch, add `<img src={nbaLogo} className="absolute inset-0 m-auto h-56 w-56 opacity-[0.06] pointer-events-none" />` centered behind the empty state copy. Import from `@/assets/nba-logo.svg`.

## 5) Player modal — wire team badge + tricode
- `src/components/PlayerModal.tsx`: in the header where the team badge image and 3-letter code are rendered, wrap both in a single `<button onClick={() => setSelectedTeamTricode(tricode)}>` (or call `onTeamClick(tricode)` prop). Open `TeamModal` keyed on the tricode. The page hosting `PlayerModal` already opens `TeamModal` elsewhere — reuse the existing handler if present (`onTeamClick` prop), otherwise add local state + render `<TeamModal>` inside `PlayerModal`. Plan: add `onTeamClick?: (tricode: string) => void` prop to `PlayerModal` and wire from `RosterPage`, `PlayersPage`, `ScoringPage`, `TeamsPage` (each already has a `setSelectedTeamTricode` or similar).

## 6) Player Comparison modal
- `src/components/PlayerCompareModal.tsx`:
  - Add a centered NBA-logo watermark behind the stats grid (`opacity-5`, `h-48`, absolute center within the stats container).
  - In the BALLERS.IQ TAKE card: remove the existing centered NBA logo watermark; replace the wordmark watermark with emblem (top-right, transparent, rotated, opacity ~0.18 — same as Lineup Advisor). Top-left icon switches to emblem with `transparent`.

## 7) Game Detail modal — `src/components/GameDetailModal.tsx`
- Header: remove the small badge images next to each team name; render the badges as **large transparent watermarks** placed where the small badges currently sit (e.g. `h-24 opacity-20 -rotate-12` for away, `rotate-12` for home), with team name overlaid.
- Stats body: add an absolutely-positioned NBA logo watermark behind the stats area (`opacity-5`, large, centered).
- Filter rows: standardise heights — wrap each filter/toggle row in a fixed-height container (`h-10`) so team selector and FC/BC selector occupy the same vertical footprint.

## 8) /MY ROSTER — Toolbar restructure
- `src/pages/RosterPage.tsx`:
  - Primary toolbar row keeps: Court/List toggle, FC/BC badges, Lineup Advisor toggle, Schedule toggle, **Chips dropdown (new)**, Optimize, Reset.
  - New `<DropdownMenu>` containing as `DropdownMenuItem`s:
    - Captain chip toggle
    - All-Star chip toggle
    - Wildcard chip toggle
    - "Add Player" item (only when `roster.players.length < 10`)
  - Trigger: `<Button variant="outline" size="sm">` with `<Sparkles className="h-4 w-4 mr-1.5" />` + label `Chips` (font-heading uppercase). Show a small amber dot (`absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-400`) when any chip is active.
  - Active chip items show a `Check` icon at the right side; inactive items show no indicator.
  - Place dropdown between Schedule and Optimize.
  - Reset stays as standalone button outside dropdown with its existing `AlertDialog` confirmation.
  - Do not change state, mutation logic, or handler functions.

```text
[Court|List]  [FC][BC]  [LineupAdvisor]  [Schedule]  [⚡Chips ▾]  [Optimize]  [Reset]
```

## 9) /commissioner — Tabs restructure
- `src/pages/CommissionerPage.tsx`:
  - Keep h2 + Users icon + description paragraph at top, outside tabs.
  - Place the Admin Secret input persistently just below the heading (always visible regardless of tab) — simplest UX since multiple tabs depend on it.
  - Wrap remaining content in `<Tabs>` with three triggers: **Players**, **Game Data**, **Sync**.
    - **Players**: Upload Player Database, Download Player Database, Preview Table (conditional), bottom info/legend box.
    - **Game Data**: Encoding selector, Import Game Data, Import Schedule, Import Player Advanced Stats.
    - **Sync**: YouTube Recaps card (and any sync-status cards).
  - Persist active tab in `localStorage` under key `commissioner_active_tab` (read on mount via `useState(() => localStorage.getItem(...) || "players")`, write in `onValueChange`).
  - No state/handler logic changes — only JSX reorg.

## Technical notes
- New `BallersIQCard` prop: `watermark?: "emblem" | "none"` (default `"emblem"`). Removes the current always-on wordmark and replaces with conditional emblem.
- `LineupAdvisorPanel` already passes `compact` to inner cards; will additionally pass `watermark="none"`.
- `BallersIQRecapBlock` will pass `watermark="none"` to inner cards and own a single emblem watermark on the outer wrapper.
- No DB / edge function changes. No new asset uploads (all assets already in `public/brand/`).
- All changes are visual + minor structural; no behavior or contract changes.
