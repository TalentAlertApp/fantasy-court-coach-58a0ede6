# Polish pass: onboarding, /leagues, sidebar, team modal, logo splash

## 1. Onboarding — align the brand bundle position
The "Name Your Franchise" screen positions the NBA / WNBA / EuroLeague + HOOPSFANTASY bundle differently from the "Draft Your Squad" screen.

- In `src/components/onboarding/NameStep.tsx`, change the bundle wrapper from `absolute top-6 left-6` to `absolute top-4 left-8` so it sits at the exact same offset as the `px-8 py-4` header used in `OnboardingHero.tsx` (Draft Your Squad). Logo sizes, separators and spacing already match.

## 2. /leagues — premium header, bigger action buttons, consistent separator, scoring-aligned position
File: `src/pages/LeaguesPage.tsx`

**a) Bigger Join / Create buttons + HF watermark**
- Enlarge both header buttons ("Join with code", "Create League") — taller and wider (e.g. `h-11`, more horizontal padding, slightly larger label/icon). They still fit inside the current header block, so the header's overall height is unchanged.
- Add the HoopsFantasy logo (`getHoopsFantasyLogo`) as a watermark pinned to the far-right inside the "Create League" button, with a hover "surge" (scale-up + opacity increase) matching the app's existing watermark surge pattern. Make the button `relative overflow-hidden group` so the watermark clips and animates on hover.

**b) Consistent thin separator under the tabs**
- Today the sticky header's bottom border sits directly under the tab toggles on Discover, but under the filter bar on My Leagues (because the Mine filter bar lives inside the sticky region). Move the My Leagues filter bar out of the sticky region into the `TabsContent value="mine"` block (mirroring how Discover renders its own filter bar). Result: on both tabs the thin separator renders identically right beneath the toggle row.

**c) Match the /scoring header vertical position**
- Remove the redundant horizontal padding and extra top offset so the header starts at the same point as `/scoring`. Change the page container from `px-6 pb-5 ...` to `pb-5 ...` (the `.page-scroll` wrapper already supplies `px-6`/`py-5`), and reduce the sticky region's top padding (`pt-5` → `pt-0`) so the header — and everything below it — moves up to align with the Scoring page header.

## 3. Left sidebar — restyle the divider above Player Search
File: `src/components/layout/AppLayout.tsx`
- Keep the separator above the Player Search box but make it more subtle/refined than the structural `sidebar-divider`s: render an inset, lower-opacity hairline (horizontal margin + reduced opacity) so it reads as a lighter, more premium separation. Only this one divider is changed; the global `.sidebar-divider` style stays intact.

## 4. Team modal — add Height ("H") column to the Roster tab
File: `src/components/TeamModal.tsx`
- Add `height` to the players `select(...)` in the `team-roster-agg` query and carry it through the mapped roster objects.
- In the Roster tab table, add an `H` column header and cell placed immediately before `MPG`, populated from `p.height ?? "—"` (same source/format as the Players page).
- Rebalance column widths for breathing room and widen the dialog just enough (`max-w-lg` → `max-w-xl`) to fit the extra column cleanly.

## 5. Big-logo splash on key modal opens
- Add a small reusable splash (e.g. `src/components/brand/LogoSplash.tsx`) that briefly fades/scales the large HoopsFantasy logo (`getHoopsFantasyLogo`) over the modal surface for ~0.8s when the modal opens, then fades out — non-blocking (pointer-events-none) and respects the active league logo.
- Wire it into the Team of the Week modal (`src/components/TeamOfTheWeekModal.tsx`) and the Court Show modal (`src/components/court-show/CourtShowModal.tsx`) so opening either gives a short branded moment without cluttering the steady-state UI.

## Technical notes
- All colors use existing semantic tokens / logo assets; no new CSS variables.
- Height is an existing nullable text field on `players` (used by `PlayerRow`/`PlayerModal`), so no schema or data changes are needed.
- Logo assets come from `getHoopsFantasyLogo(league)` in `src/lib/hoopsfantasy-brand.ts`.
- Changes are presentation-only; no business-logic or data-flow changes.
