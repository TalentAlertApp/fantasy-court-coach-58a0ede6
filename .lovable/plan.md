Plan:

1. Game Played modal URL buttons
- Change the Game Played modal header actions (BoxScore, Charts, PbP) from opening the iframe-style `NBAGameModal` to opening the exact dataset URLs directly.
- Each button will use its own field:
  - `game_boxscore_url` -> BoxScore
  - `game_charts_url` -> Charts
  - `game_playbyplay_url` -> PbP
- Preserve the current visual header layout, but make the behavior deterministic for NBA, WNBA, and EuroLeague. Example: FCB @ ZAL BoxScore opens `.../E2025/329/#box-score`.
- Remove the now-misleading in-app modal behavior from this header path so clicks cannot appear “unwired” or blocked by iframe limitations.

2. ONGOING badge in league picker
- Fix the WNBA `ONGOING` badge clipping by keeping it inside the card bounds instead of floating outside the clipped/overflow-hidden card.
- Reposition it with more safe spacing above/around the WNBA logo so it no longer collides with the logo.
- Slightly tighten the badge typography/width handling so the full word always renders cleanly.

3. EuroLeague Daily Court Show watermark
- Pass the actual active `league` value from `CourtShowModal` into `CourtShowSlide`, instead of reducing it to only `wnba` vs `nba`.
- Replace NBA team/logo fallbacks in Court Show slide helpers with league-aware logo lookup for EuroLeague where the slide is using a league watermark.
- Keep the same large top-right watermark layout and opacity/blur treatment, but ensure EuroLeague slides (including Ballers.IQ, Played Games Recap, Outstanding Game/Performances, and Best Value Plays) use the EuroLeague logo, not NBA.

Files to update:
- `src/components/GameDetailModal.tsx`
- `src/components/LeaguePickerCards.tsx`
- `src/components/court-show/CourtShowModal.tsx`
- `src/components/court-show/CourtShowSlide.tsx`

Validation:
- Check that the modal buttons are normal external links with the exact dataset URL fields.
- Check that `leagueCode={league}` reaches Court Show slides.
- Check that the WNBA badge classes no longer place the badge outside the clipped card.