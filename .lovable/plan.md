# Plan

## 1. `LeaguePickerCards.tsx` — ONGOING badge position
The pill currently sits at `top-3 left-1/2 -translate-x-1/2`, overlapping the WNBA logo crown. Float it above the logo by:
- Move the badge to `-top-2.5` (or place it just above the title block) — overlapping the **top border** of the card, not the logo.
- Add subtle drop shadow so it reads as a floating chip.
- Reduce the logo wrapper's `pt` so logo & label stay vertically centered after the badge clears it.

## 2. `GameDetailModal.tsx` — wire header actions (all leagues) + EuroLeague external link

### 2a. BoxScore / Charts / PbP — convert from external `<a>` links to in-app `<button>` that opens `NBAGameModal` (already exists) with the matching tab.
- Add `const [embedTab, setEmbedTab] = useState<NBAGameTab|null>(null)`.
- Replace the three `<a href=…>` with `<button onClick={() => setEmbedTab("boxscore"|"charts"|"playbyplay")}>`. Keep current styling, drop `<ExternalLink>`.
- Render `<NBAGameModal open={embedTab !== null} defaultTab={embedTab ?? "boxscore"} urls={{game_boxscore_url, game_charts_url, game_playbyplay_url, game_recap_url}} title={`${away_team} @ ${home_team}`} onOpenChange={(o)=>!o && setEmbedTab(null)} />`.
- Keep the in-modal `GameBoxScoreTable` below — the buttons now provide the *external embedded view*, the inline table stays as the quick on-modal stat strip.

### 2b. EuroLeague external link in header
- The existing `nba_game_url` button already renders for any league and labels itself via `leagueName` (already supports `"EuroLeague"`). Investigation showed `schedule_games.nba_game_url` is populated for all 380/380 EuroLeague games, so the button will appear once the modal receives it.
- Audit every call site that constructs `GameDetailGame` and pass `nba_game_url` through: `ScheduleList.tsx`, `SchedulePreviewPanel.tsx`, `TeamCompareModal.tsx`, `TeamModal.tsx` — confirmed they already do. The only callers still likely to drop it are anything in `RosterPage.tsx` / `ScoringPage.tsx` / `CourtShowModal.tsx`. Grep them and add `nba_game_url` to the passed shape where missing.
- Swap the icon for EuroLeague rows from generic `ExternalLink` to the EuroLeague glyph (small 14px tinted league logo) so it matches the WNBA pattern shown in the screenshot. NBA/WNBA keep their current rendering.

## 3. `TeamCompareModal.tsx` — EuroLeague fixes

### 3a. Watermark logo too thin
- Replace `h-40 w-40 opacity-[0.05]` with `h-72 w-72 opacity-[0.08]` and add `object-contain`.
- This matches the other watermarks (Box Score table watermark is already `h-48`).

### 3b. EAST/WEST is wrong for EuroLeague
EuroLeague has no conferences. Gate conference UI on league:
- In `TeamHeader`, only render the `{conf}` span when `league !== "euroleague"`. Easiest: pass `league` as a prop and skip the chip for EuroLeague (rank `#N` still shows, just no East/West word).
- In the Standings table, skip the `Conf Rank` `MetricRow` entirely when `league === "euroleague"` — only render `League Rank`.
- `confRank` memo can stay (harmless) but is no longer referenced for EuroLeague.

## Files touched
- `src/components/LeaguePickerCards.tsx`
- `src/components/GameDetailModal.tsx`
- `src/components/TeamCompareModal.tsx`
- Any call site passing `GameDetailGame` that drops `nba_game_url` (audit `RosterPage`, `ScoringPage`, `CourtShowModal`, `PlayerModal`)

No DB migrations, no edge function changes.
