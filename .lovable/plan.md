## Ballers.IQ Lineup Strip — Single Compact Entry Point

Add one compact horizontal Ballers.IQ summary strip to the Lineup page. Remove the existing "Lineup Advisor" toggle + overlay/side panel to avoid duplication. The strip surfaces four signals at a glance and offers a single action that opens the existing AI Coach modal. No per-player buttons, no floating widgets, no extra panels.

### Strip content (single row, left-to-right)
- BallersIQ emblem + label
- Captain Edge: top starter by `fp_pg5` (e.g. "Dončić")
- Risk Radar: count of risky starters (injury / minutes slip / no-game)
- Value Pick: best bench `value5` player name
- Schedule Drag: count of starters with no upcoming game in the next 7 days
- Single small "Open Ballers.IQ" button → `setAiCoachOpen(true)` (existing modal)

If no signal exists for a slot, show "—" so the strip stays visually steady.

### Layout
Insert directly beneath the command header (the deep-blue Gameweek/Day banner around line 460), above the toolbar row. Single row on `md+`, stacks gracefully on mobile. Uses `bg-card`, subtle amber accent for the BIQ chip — consistent with existing brand usage. Court layout stays untouched.

### Files to edit
- `src/pages/RosterPage.tsx`
  - Remove the `advisorOpen` state, the Lineup Advisor toggle button (~lines 534–545), the court-mode `LineupAdvisorPanel` overlay (~lines 638–643), and the list-mode side `LineupAdvisorPanel` (~lines 682–686). Remove the `LineupAdvisorPanel` import.
  - Compute strip values (memoized) from `biqAdvisor.insights` (Captain / Risk / Value) plus a small helper using `upcomingByTeam` to count starters with zero upcoming games for Schedule Drag.
  - Render new `<BallersIQLineupStrip />` component just below the command header.
- `src/components/ballers-iq/BallersIQLineupStrip.tsx` (new)
  - Pure presentational component. Props: `{ captainName, riskCount, valueName, scheduleDragCount, onOpen }`.
  - Compact pill row with `BallersIQBrand` emblem and a small `Button` "Open Ballers.IQ" calling `onOpen()`.

### What stays untouched
- The existing wordmark "Open Ballers.IQ" button in the command header remains (it is the canonical entry).
- AICoachModal logic, Analyze/Captain/Transfer/Explain flows.
- Schedule preview overlay, Optimize, Wishlist, court/list toggle, RosterCourtView, RosterListView, RosterSidebar.
- `LineupAdvisorPanel.tsx` file remains on disk (just unused on the lineup page) so other consumers aren't broken.

### Acceptance check
- One compact strip visible on Lineup with the four signals.
- Only one new tiny CTA, "Open Ballers.IQ", reusing the existing modal.
- The duplicate "Lineup Advisor" toggle and side panel are gone.
- No new floating widget, no per-player AI button, court area unchanged in size.
