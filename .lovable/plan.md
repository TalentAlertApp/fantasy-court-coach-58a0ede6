## EuroLeague-only fixes (5)

### 1) Tricode mismatch with DB_Teams → fixes empty cards (BAR/FCB, EA7/MIL, PAO/PAN, HTA/HAP, FBB/FEN, BKN/BAS, PBB/PAR, PRS→Paris) and missing CZV / VBC

Source of truth = sheet DB_Teams. Rewrite `src/lib/euroleague-teams.ts` to:

| Old tricode | New tricode | Notes |
|---|---|---|
| FCB | **BAR** | FC Barcelona |
| MIL | **EA7** | EA7 Emporio Armani Milan |
| PAN | **PAO** | Panathinaikos AKTOR Athens |
| FEN | **FBB** | Fenerbahce Beko Istanbul |
| BAS | **BKN** | Baskonia Vitoria-Gasteiz |
| HAP | **HTA** | Hapoel Tel Aviv |
| MTA | MTA | name → "Maccabi Rapyd Tel Aviv" |
| PAR (Partizan) | **PBB** | Partizan Mozzart Bet Belgrade |
| PRS (Paris) | **PAR** | Paris Basketball (now PAR) |
| VIR | VIR | name → "Virtus Bologna" |
| ASM, ASV, ZAL, RMB, BAY, DUB, OLY, EFS | unchanged | name polish |
| — | **CZV** | Crvena Zvezda Meridianbet Belgrade (new) |
| — | **VBC** | Valencia Basket (new) |

Result: 20 teams matching the sheet. Drop the duplicate "Hapoel IBI Tel Aviv" / "Paris Basketball" entry shown twice on /teams.

Because rows in `sport_teams`, `players`, `schedule_games`, `player_game_logs` are keyed by the sheet's tricode (BAR, EA7, PBB, etc.), aligning the static catalog is what unblocks player counts, records, logos, venue art and standings for those clubs. No DB writes needed — `useLeagueTeams` already hydrates from `sport_teams` on top of the static catalog.

Re-run on /commissioner after deploy: Sync Teams → Sync Player Database → Sync Schedule → Sync Game Data → Recalculate Salaries.

### 2) Player photos cut off at the face

EuroLeague photos are full-body, so `object-cover object-top` chops the head. Switch all small/circular player avatars to a face-friendly position:
- `PlayerCard.tsx` (circle photo): add `object-top` → `object-[center_15%]`
- `PlayerRow.tsx`, `PlayerModal.tsx` thumbnails: `object-top` → `object-[center_15%]`
- Only applied where the photo is rendered in a square/circle crop; keep full-bleed hero photos untouched.

Single rule applies league-wide (NBA/WNBA faces stay visible — 15% from top is within head area for all three feeds).

### 3) Player Modal — nationality missing

The sync already reads column P (NAT) into `players.nationality` and the modal already renders `<NationalityFlag>`. The visible blank is because the column was added after the last full DB_Players sync. No code change — re-run **Sync Player Database** on /commissioner. Plan-side fix: add a one-line note in `EuroleagueSheetSyncPanel` reminding to re-run Player sync; also map a few common sheet variants ("United States of America" → "United States", "Republic of …" trims) inside `syncPlayers` so the flag lookup matches.

### 4) Game recap — embed YouTube like NBA/WNBA; remove "Watch Recap on NBA.com" label

Two files still say NBA literally:
- `src/components/PlayerModal.tsx:481`
- `src/components/TeamModal.tsx:317`

Replace both with a league-aware label: NBA → "Watch Recap on NBA.com", WNBA → "Watch Recap on WNBA.com", EuroLeague → "Watch Recap on YouTube". Use `useLeague()`.

Embedding: `GameDetailModal.toYouTubeEmbed()` already supports `youtube.com/watch`, `youtu.be`, and a raw `youtube_recap_id`. EuroLeague's `game_recap_url` from the sheet is the official EuroLeague page, which won't embed.

Strategy:
1. In `euroleague-sheet-sync` `syncSchedule`, when `game_recap_url` is not a YouTube URL, leave it as the official link and add a follow-up: hit `youtube-recap-lookup` (already used for NBA/WNBA) with `{home, away, date, league: "euroleague"}` to fill `schedule_games.youtube_recap_id`.
2. `GameDetailModal` already prefers `youtube_recap_id` when computing the embed, so the iframe will render the YouTube clip while the "Open original" button still deep-links to euroleaguebasketball.net.
3. If lookup misses, modal falls back to the existing "Open recap" button (no broken iframe).

No new edge function needed beyond passing `league: "euroleague"` through `youtube-recap-lookup`; add EuroLeague query templates (`{home} vs {away} highlights EuroLeague {date}`).

### 5) Injury Report for EuroLeague

Replace the "coming soon" placeholder in `InjuryReportModal` with a real feed. Mirror `wnba-injury-report`:
- New edge function `euroleague-injury-report` (public, 30-min cache) scraping two reliable sources:
  - **Rotowire EuroLeague injuries** — `https://www.rotowire.com/basketball/euroleague-injury-report.php`
  - **Eurohoops injury list** — `https://www.eurohoops.net/en/tag/euroleague-injuries/` (secondary, lower priority — only fills gaps)
- Normalise statuses (Out / Questionable / Doubtful / Day-To-Day) and map team names to the new tricodes from fix #1.
- Wire `InjuryReportModal.tsx`: when `league === "euroleague"`, call the new function instead of rendering the placeholder.

---

### Files touched
- `src/lib/euroleague-teams.ts` (rewrite catalog)
- `src/components/PlayerCard.tsx`, `src/components/PlayerRow.tsx`, `src/components/PlayerModal.tsx` (photo crop position)
- `src/components/PlayerModal.tsx`, `src/components/TeamModal.tsx` (recap label)
- `src/components/InjuryReportModal.tsx` (EuroLeague branch)
- `supabase/functions/euroleague-sheet-sync/index.ts` (post-schedule YouTube lookup, nationality normalisation)
- `supabase/functions/youtube-recap-lookup/index.ts` (EuroLeague query templates)
- **New**: `supabase/functions/euroleague-injury-report/index.ts`

### Manual follow-up after deploy
On /commissioner → EuroLeague panel, run in order: Sync Teams → Sync Player Database → Sync Schedule → Sync Game Data → Recalculate Salaries.