## Goal

Fix the 3 EuroLeague sync paths flagged in the log:

```
recap lookup  processed: 100  found: 0   remaining: 433
teams         read: 21        upserted: 20  skipped: 1
players       read: 335       upserted: 335 skipped: 0
```

Players already imports cleanly (335/335) — verified, no change needed; the rest of the work is in the other two syncs.

---

## 1. EuroLeague YouTube recap lookup — 0/100 matches

### Why nothing matches today

In `youtube-recap-lookup/index.ts` the scorer hard-requires that the title contain the *full* nickname from `EUROLEAGUE_TEAM_NICKNAMES` (e.g. `"anadolu efes"`, `"olimpia milano"`, `"crvena zvezda"`, `"panathinaikos"`). Official EuroLeague / club / Eurohoops upload titles almost never use that exact phrase — they shorten to `Efes`, `Olimpia`, `Milan`, `Zvezda`, `Pana`, `Madrid`, `Olympiakos`, etc. Result: both-teams hard check fails every time → 0 found, ~80 quota burned.

### Fix

Replace the single-nickname `EUROLEAGUE_TEAM_NICKNAMES` map with a per-team **alias list**, and change the EuroLeague scoring path so a team is "present" if **any one alias** is found in the title.

```ts
const EUROLEAGUE_TEAM_ALIASES: Record<string, string[]> = {
  EFS: ["anadolu efes", "efes"],
  ASM: ["monaco"],
  CZV: ["crvena zvezda", "zvezda", "red star"],
  DUB: ["dubai"],
  EA7: ["olimpia milano", "olimpia milan", "ea7", "milano", "milan"],
  BAR: ["barcelona", "barça", "barca"],
  BAY: ["bayern", "munich", "münchen"],
  FBB: ["fenerbahce", "fenerbahçe"],
  HTA: ["hapoel tel aviv", "hapoel"],
  BKN: ["baskonia"],
  ASV: ["asvel", "villeurbanne"],
  MTA: ["maccabi tel aviv", "maccabi"],
  OLY: ["olympiacos", "olympiakos"],
  PAO: ["panathinaikos", "pana"],
  PAR: ["paris basketball", "paris"],
  PBB: ["partizan"],
  RMB: ["real madrid", "madrid"],
  VBC: ["valencia"],
  VIR: ["virtus bologna", "virtus", "bologna"],
  ZAL: ["zalgiris", "žalgiris", "kaunas"],
};
```

In the EuroLeague branch:
- Replace `awayCity`/`homeCity` substring check with `aliases.some(a => title.includes(a))` per team.
- Keep the "both teams must appear" requirement.
- Keep `+1 highlights`, `+2 full game`, `+3 long date` scoring; add `+1 round` when title contains `"round"` (very common in EL titles).
- Lower EuroLeague `minScore` from 4 → **5** (alias matches are cheaper to get, so we tighten slightly to avoid noise).
- Disable `same-night cross-team rejection` for EuroLeague — `sameNightTeamCities` is built from NBA `TEAM_CITY` and is meaningless for EL anyway (it's effectively empty, so this is a no-op cleanup).
- Bump `maxResults` from 10 → 15 for EuroLeague primary search and add a second query variant `"{away} {home} highlights round {date}"` when the first returns 0 items, before falling back to open search.

### Schedule prerequisite

Before re-running recaps, check that EuroLeague `schedule_games.status` rows actually flipped to `FINAL` for completed games — the lookup only considers `FINAL` rows. If not, that's a separate ingestion issue; flag it in the run summary rather than silently filter to zero candidates.

---

## 2. Teams sync — 1 row skipped + EA7 venue image still broken

### a) Surface the skip reason

`syncTeams` already collects `warnings[]` (e.g. `row #N: missing TEAM_CODE — skipped`), but the commissioner panel only renders `read / upserted / skipped`. Extend the rendered response so the 1 skipped row is explained:

- Return `warnings` in the JSON (already present) and render them as a small text block under the Teams row in `EuroleagueSheetSyncPanel.tsx` when `warnings.length > 0`.
- No DB change.

This lets the user see exactly which row was skipped (likely an empty/edited trailing row) without guessing.

### b) Extend `normalizeWikiImageUrl` to handle Wikidata + plain Commons file pages

Current normalizer only rewrites `*.wikipedia.org/wiki/...#/media/File:...`. The EA7 venue is still `https://www.wikidata.org/wiki/Q604681#/media/File:Forum_Assago_Parquet_2.jpg`, which `<img>` cannot render.

Generalize to match **any** `…#/media/File:<filename>` (wikidata, wikimedia, wikipedia in any language) and also a bare `commons.wikimedia.org/wiki/File:<filename>` form:

```ts
function normalizeWikiImageUrl(raw: string | null): string | null {
  if (!raw) return raw;
  const m1 = raw.match(/#\/media\/File:(.+)$/i);
  if (m1) return `https://commons.wikimedia.org/wiki/Special:FilePath/${m1[1].split("?")[0]}`;
  const m2 = raw.match(/commons\.wikimedia\.org\/wiki\/File:(.+)$/i);
  if (m2) return `https://commons.wikimedia.org/wiki/Special:FilePath/${m2[1].split("?")[0]}`;
  return raw;
}
```

After re-running **Sync → Teams**, EA7's `venue_image_url` becomes a renderable Commons FilePath URL like the EFS/PAO/PBB rows already do.

---

## 3. Players sync — verify only, no code change

Log says `read: 335 / upserted: 335 / skipped: 0`. The dynamic-header column mapping (`find("HEIGHT") / find("DOB") / find("NAT") / …`) already lands the right values in the right DB columns (verified in code). No change.

---

## Files

- `supabase/functions/youtube-recap-lookup/index.ts` — alias map + alias-aware EuroLeague scorer + minScore tweak + 2-query primary path.
- `supabase/functions/euroleague-sheet-sync/index.ts` — generalize `normalizeWikiImageUrl`.
- `src/components/commissioner/EuroleagueSheetSyncPanel.tsx` — render `warnings[]` under the Teams row.

## Post-deploy

1. **Sync → Teams** (fixes EA7 venue image; surfaces the skipped-row reason).
2. **Find YouTube Recaps** (EuroLeague) — expect a meaningful non-zero `found` count this time.

No DB migrations.