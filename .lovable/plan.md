## 1. Sidebar divider above Player Search — simple premium hairline

In `src/components/layout/AppLayout.tsx` (line ~204) the divider is a gradient bar that reads too thick/fancy. Replace it with a dead-simple, ultra-faint static hairline — no gradient, no hover surge, no color change:

```text
<div className="mx-3 my-1 h-px bg-sidebar-border/40" />
```

(plain 1px line, fixed opacity, matches the Player Search box width via `mx-3`). No hover state is attached so nothing animates.

## 2. /scoring header

In `src/pages/ScoringPage.tsx`:

- **(a) Remove the upper header** — delete the entire premium gradient title bar block (lines ~135–160: the `Activity` icon + "SCORING / League standings · Team performance").
- **(b) Center the tab toggle.** The current row is `FantasyLeagueSelector` + `UnderlineTabsBar(flex-1)` + team selector at right. Replace the flex row with a **3-column grid** (`grid grid-cols-[1fr_auto_1fr] items-center`) so the LEAGUE / YOUR TEAM / TX PULSE bar sits in the dead-center column and gets equal space on both sides:
  - left cell: `MAIN LEAGUE` selector (justify-start)
  - center cell: the underline tab group (justify-center)
  - right cell: the `TEAM` selector when on "Your Team" (justify-end); empty otherwise so the center stays put.

This keeps all three tabs and their content unchanged.

## 3. /leagues header

In `src/pages/LeaguesPage.tsx`:

- **(a) Remove the upper header** — delete the big gradient card block (lines ~440–510: Swords icon, "MY LEAGUES / Fantasy competitions", and the two large buttons in their current form). Keep the `PageHeaderCaption` ("Leagues · Mine & Discover").
- **(b) Single centered control row.** Rebuild the tab row as a **3-column grid** (`grid grid-cols-[1fr_auto_1fr] items-center`):
  - **left cell:** `JOIN WITH CODE` and `CREATE LEAGUE` restyled as **compact cards** matching the height of the Grid/List view buttons (`h-7`, small `text-[9px]` heading, tighter padding). The Create-League HF logo watermark + hover surge is preserved at a smaller scale.
  - **center cell:** the MY LEAGUES / DISCOVER underline tab group, justify-center.
  - **right cell:** the existing Grid/List view toggle, justify-end.

The tabs are thus fully centered with balanced space to the Join/Create cards (left) and the Grid/List buttons (right). Both tab contents stay unchanged. The Join dialog stays wired to the compact "Join with code" card.

## 4. /teams and /advanced caption — league/team logo watermark instead of the name

Replace the league-name text in the caption with the league logo image (the same `getLeagueLogo(league)` asset already used on these pages), rendered inline as a small watermark a touch larger than the caption text, with a subtle hover surge:

- **`src/pages/TeamsPage.tsx`** (caption ~line 150): change `{league} · Teams Hub` so the leading "WNBA/NBA/EuroLeague" word becomes `<img src={leagueLogo} className="inline-block h-4 w-auto opacity-70 transition-transform duration-300 hover:scale-125 align-[-2px]" />` followed by `· Teams Hub`.
- **`src/pages/AdvancedPage.tsx`** (caption ~line 899): change `Advanced · {competition.label} Insights` to `Advanced · <logo img> Insights`, importing/using the same `getLeagueLogo(league)` (Advanced already has `useLeague`). Logo height ~`h-4` (slightly above the `text-[10px]` caption), `opacity-70`, hover `scale-125`.

### Technical notes
- All changes are presentation-only — no data/hooks/business-logic touched.
- Centering uses a `grid-cols-[1fr_auto_1fr]` wrapper so the middle tab group is optically centered regardless of the differing widths of the side clusters (the requested "same space left and right").
- Reuse existing tokens (`--sidebar-border`, `--nba-yellow`, `getLeagueLogo`, `getHoopsFantasyLogo`) and the existing `UnderlineTabsBar` / `UnderlineTabsBarManual` primitives; the compact Join/Create cards reuse the existing `Button` with smaller size classes.
