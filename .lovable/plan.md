## Diagnosis

The `youtube-recap-lookup` edge function uses a single `TEAM_FULL_NAME` / `TEAM_CITY` map that is NBA‑first. Most WNBA tricodes used in `schedule_games` (`ATL`, `CHI`, `IND`, `WAS`, `DAL`, `MIN`, `TOR`, `POR`, `LAS`) collide with NBA codes and resolve to NBA franchise names (Hawks, Bulls, Pacers, Wizards…). The YouTube search query becomes nonsense (e.g. *"Atlanta Hawks vs Chicago Bulls Highlights"* on the official `@WNBA` channel) and returns zero matches. This is why "Populate" reports `Found 0 / Checked 100` for WNBA. NBA path is unaffected.

Auto‑pause of the Court Show on Game Recap play was already wired in a prior turn (`onVideoPlayingChange` from `CourtShowSlide` → `CourtShowModal`).

---

## Plan

### A. Fix WNBA team resolution in `youtube-recap-lookup` (NBA path untouched)

File: `supabase/functions/youtube-recap-lookup/index.ts`

1. Keep the existing NBA `TEAM_FULL_NAME` and `TEAM_CITY` maps and the GAMETIME channel logic exactly as they are.
2. Add a separate, WNBA‑only pair of maps keyed by the actual WNBA tricodes used in `schedule_games`:

   Full names (used in YouTube search query):
   ```
   ATL=Atlanta Dream         CHI=Chicago Sky         CON=Connecticut Sun
   IND=Indiana Fever         NYL=New York Liberty    TOR=Toronto Tempo
   WAS=Washington Mystics    DAL=Dallas Wings        GSV=Golden State Valkyries
   LVA=Las Vegas Aces        LAS=Los Angeles Sparks  MIN=Minnesota Lynx
   PHX=Phoenix Mercury       POR=Portland Fire       SEA=Seattle Storm
   ```

   City/nickname tokens (used in title scoring) — pick the unique nickname since titles always include the team nickname (e.g. "Connecticut Sun vs. New York Liberty | FULL GAME HIGHLIGHTS | May 8, 2026"):
   ```
   ATL=dream    CHI=sky      CON=sun        IND=fever     NYL=liberty
   TOR=tempo    WAS=mystics  DAL=wings      GSV=valkyries LVA=aces
   LAS=sparks   MIN=lynx     PHX=mercury    POR=fire      SEA=storm
   ```
3. After determining `isWnba` (already in code via `leagueCodeById`), pick the correct lookup pair and use it for `awayFull`, `homeFull`, `awayCity`, `homeCity`. NBA games keep using the NBA maps untouched.
4. Tighten the WNBA query string to mirror the official channel pattern: `"{Away Full} vs. {Home Full} FULL GAME HIGHLIGHTS"`. Keep the WNBA channel id (`UCqYwOSqyi0tEPRRwTPL5MXA` → `@WNBA`) and the existing time window, scoring weights, fallback open search, replace‑mode behaviour, and quota handling unchanged.
5. **Backfill**: deploy and trigger one `replace=1` scan scoped to WNBA only. WNBA has ~330 games in the 2026 Regular Season (≈3 batches of 100). Run via the same edge function and report `processed / found / remaining` per batch. Do **not** rescan any NBA games.

### B. Verify the player UX

- `/schedule` Grid + List → expand a WNBA game with a freshly populated `youtube_recap_id` and confirm the embedded recap plays inside the card (`RecapCard` in `ScheduleList.tsx`, already implemented).
- Daily Court Show → "Outstanding Game" slide → confirm the embedded recap plays and that:
  - the slide does **not** advance while the video state is `playing` or `buffering`,
  - the show resumes auto‑advance once the user pauses, ends, or manually browses to another slide.
  Already implemented via the `videoPlaying` gate on the auto‑advance timer + progress bar in `CourtShowModal.tsx`. If QA reveals a regression (e.g. iframe state events not firing), patch the listener; otherwise no code change.

### C. Out of scope

- No DB schema changes.
- No NBA recap logic changes.
- No frontend changes unless QA in B uncovers a regression.

## Technical notes

- Title example confirmed: `Connecticut Sun vs. New York Liberty | FULL GAME HIGHLIGHTS | May 8, 2026`. With nickname tokens (+2/+2), `full game` (+2), `highlights` (+1) and the long date (+3), every WNBA recap will land far above the WNBA `minScore` threshold.
- Quota: ~100 units per game lookup. ~330 WNBA games ≈ 33 000 units → comfortably under one day of YouTube Data API daily quota; the full WNBA backfill should complete in a single scan triggered after deploy.
- Secret already configured: `YOUTUBE_API_KEY`. No new secrets required.
