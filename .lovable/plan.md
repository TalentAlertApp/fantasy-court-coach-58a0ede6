## Overview
Four focused UI changes across MY ROSTER, Transactions, and the Teams → Standings tab. No backend or standings-math changes; the new venue table derives its numbers from schedule data already loaded on the page.

---

## 1. MY ROSTER (`/`) — shrink the COURT/LIST toolbar strip
**File:** `src/pages/RosterPage.tsx` (toolbar row ~lines 943–977)

- Reduce the strip's vertical footprint so the COURT view fits without vertical scroll:
  - `mb-3` → `mb-2` on the toolbar row.
  - Make the COURT/LIST toggle items shorter (compact height, `py-1`, smaller icon gap) and the FC/FC badges slightly smaller (`py-0` / tighter line-height).
  - Trim the sticky header block's bottom padding (`pb-2` → `pb-1.5`) so the court area gains height.
- Goal: the court view becomes a "still" screen (no up/down scroll) at the current viewport. No logic changes — purely spacing/size tokens.

---

## 2. Transactions (`/transactions`)
### 2a. Trade Report title icon
**File:** `src/components/transactions/TradeReport.tsx`
- Replace the AI-styled `Sparkles` icon next to "TRADE REPORT" with a context-appropriate trade icon: `Handshake` (people/deal) from lucide-react. Update the import accordingly.

### 2b. Reduce Trade Report card height
**File:** `src/components/transactions/TradeReport.tsx`
- (i) **Roster Impact rows:** in `MetricRow`, reduce row padding `py-2` → `py-1` (tighter spacing between rows). Also tighten the sticky column-header row padding.
- (ii) **Footer buttons** ("← Back to picking", "Commit Trade"): shrink to `h-8` with smaller text, and give a premium look — keep "Back to picking" as a subtle outline/ghost, and style "Commit Trade" with the accent gradient + glow/sheen treatment already used by the workbench TRADE button (accent bg, soft shadow, hover scale).
- (iii) **Header:** reduce height (`py-3` → `py-2`) and shrink the title font (`text-sm` → `text-xs`), keeping the GW·Day badge and close button.

### 2c. Pin the page header + action buttons
**File:** `src/pages/PlayersPage.tsx` (header region ~lines 694–775)
- Wrap the `PageHeaderCaption` ("Transactions · Trade Center") together with the compact button row (Schedule, Ballers.IQ, All-Star, Wildcard) in a single sticky container, mirroring the RosterPage pattern: `sticky top-0 z-30 bg-background/95 backdrop-blur-sm` with horizontal bleed (`-mx-6 px-6`) so it stays fixed while the workbench/report/table scroll beneath — matching /scoring behavior.

---

## 3. Teams → Standings (`/teams`)
### 3a. De-emphasize the 3 Ballers.IQ cards below the tables
**File:** `src/pages/TeamsPage.tsx` (`StandingsBallersIQ`, ~lines 334–347)
- Remove the outer borderline of the three cards (drop `border border-amber-400/25` on each inner card and the outer `section` border), reduce their padding so the block covers less area, and nudge the block down slightly. The block stays bottom-anchored (`mt-auto`) so its bottom remains just above the left sidebar's bottom edge.

### 3b. New venue companion table (League view only)
Applies to: **EuroLeague** (single League table), **WNBA → LEAGUE subtab**, **NBA → LEAGUE subtab**. Conference/Division views are unchanged.

New table sits to the **left** of the existing standings table, occupying **~1/4** of the content width (full width minus sidebar), with the main table taking the remaining 3/4. Columns:

| Column | Source |
|--------|--------|
| **Arena** | Team venue name (from `useLeagueTeams` → `venueName`), rendered over the team's venue image as a decorative background |
| **Market** | Team city |
| **Conference** | `StandingRow.conference` (— when none, e.g. EuroLeague) |
| **HW%** | Home win % = homeW / (homeW + homeL) |
| **HDIFF** | Home point differential = avg (home points scored − allowed) in home games |
| **HE** | Home Edge = Home win% − Away win% |

**Row-order sync (critical):** the new table must always match the existing table's row order, including live re-sorts.
- Lift the sort state out of `StandingsTable` so both tables share one ordering:
  - `src/components/standings/StandingsTable.tsx`: add optional controlled-sort props (`sortKey`, `sortDir`, `onSort`). When provided, render rows in the given order and delegate header clicks to `onSort` instead of using internal state (uncontrolled behavior preserved when props are absent).
- New wrapper `src/components/standings/LeagueStandingsWithVenue.tsx`:
  - Owns `sortKey`/`sortDir`, computes the ordered rows once (same sort + GB logic), and renders: venue table (left, `w-1/4`) + `StandingsTable` (right, `flex-1`, controlled-sort) so both consume the identical ordered array.
  - Venue rows mirror the main table's row height for visual alignment.
- `src/components/standings/StandingsPanel.tsx`: in the `view === "league"` branch, render `LeagueStandingsWithVenue` (new props for `leagueTeams` + per-team home splits) instead of the bare `StandingsTable`. Other branches untouched.
- `src/pages/TeamsPage.tsx`: pass `leagueTeams` and the already-loaded `scheduleData` down to `StandingsPanel`.

**Home splits computation (display-only, no standings-math change):**
- New helper `src/lib/standings-home-splits.ts`: from the schedule rows already fetched in TeamsPage (`home_team, away_team, home_pts, away_pts, status`), aggregate per-team home/away records and home points for/against. Returns a map keyed by tricode with `homeW, homeL, awayW, awayL, homePf, homePa, homeGames`. Used only to feed HW%/HDIFF/HE — the existing `useNBAStandings` calculation is left exactly as-is.

**Market (city) data:**
- New helper `src/lib/team-markets.ts`:
  - NBA: explicit tricode→city map (30 teams) for accuracy.
  - WNBA: explicit tricode→city map.
  - EuroLeague: pull `city` from the synced team record (`getEuroLeagueTeamRecord`).
  - Fallback: derive from team name if no mapping found.

**Accessibility (per request):**
- Venue image is a decorative background only: applied via CSS background (or `<img aria-hidden alt="">` behind text), never conveying meaning.
- Arena name stays as real, selectable text layered above the image with a readable scrim/overlay for contrast.
- If a venue image is missing, no broken-image icon appears — the cell falls back to a plain themed background with the arena text still shown.

---

## Technical notes
- All colors use existing semantic tokens; venue text uses a gradient/scrim overlay for legibility in both light and dark themes.
- The venue table is shown at `lg+` widths; on narrow screens it collapses gracefully (stacks or hides) to avoid cramping, since Standings is a desktop-first view.
- No database, edge-function, or standings-calculation changes.
</content>
<summary>UI-only changes: shrink the roster COURT toolbar, slim down the Trade Report card (icon, row spacing, premium compact footer buttons, shorter header) and pin the Transactions page header, plus de-border the Standings BallersIQ cards and add a venue companion table (Arena/Market/Conference/HW%/HDIFF/HE) on League-view standings that stays sorted in lockstep with the main table.</summary>
</invoke>
