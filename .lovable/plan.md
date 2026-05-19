## Goal
Add player **nationality** (WNBA only) to the dataset and surface it in 4 specific places. No other surfaces are touched, and the field is NOT factored into any rating.

## 1. Data layer

**Migration** — add nullable column to `players`:
```sql
ALTER TABLE public.players ADD COLUMN nationality text;
```
(NBA rows stay NULL; only WNBA rows are populated.)

**Initial backfill** — apply the 258 ID→NAT pairs from the attached CSV directly in the same migration via `UPDATE` statements, normalizing `USA` → `United States` so the value is consistent.

## 2. Source-of-truth: Google Sheet ingestion

`supabase/functions/wnba-sheet-sync/index.ts` (the "PLAYER DATABASE" job):
- Widen `DB_Players` fetch range from `A1:O5000` to `A1:P5000`.
- Add `nationality: nullable(r[15])` to the upsert payload (column P = NAT, right after POS at column O).
- Normalize `"USA"` → `"United States"` on read so the value is stable.

No change to NBA `import-players` (column does not exist there; stays NULL).

## 3. Edge function payload

`supabase/functions/player-detail/index.ts` — include `nationality: playerRow.nationality` inside `player.core` so the Player Modal can read it.

`supabase/functions/players-list/index.ts` — include `nationality` in the row projection so the LIST VIEW and Team Modal roster tab can render it.

## 4. Frontend — flag rendering helper

New file `src/lib/nationality.ts`:
- Map of country name → ISO-3166 alpha-2 (covers the 28 distinct values found in the CSV: USA/United States, Australia, Bahamas, Belgium, Bosnia and Herzegovina, Brazil, Cameroon, Canada, China, Czech Republic, Finland, France, Germany, Greece, Hungary, Italy, Lithuania, Mali, Mexico, Netherlands, New Zealand, Russia, Serbia, Slovenia, South Korea, Spain, United Kingdom).
- `flagEmoji(country)` → emoji built from regional-indicator codepoints (no extra dependency).
- `countryLabel(country)` → display name normalized.

A tiny round-flag component `<NationalityFlag country size />` rendering the emoji inside a circular badge styled with the existing design tokens. (Pure emoji = zero asset weight, native cross-platform rendering.)

## 5. Frontend — 4 surfaces

a) **Player Modal** (`src/components/PlayerModal.tsx`, line ~211): append ` · <flag> Country` immediately after the College segment in the bio line.

b) **List View** (`src/components/PlayerRow.tsx`, after the College `TableCell` at ~150-152): new `TableCell` "NAT" rendering the country **name** (e.g. "Brazil"). Add a matching `<TableHead>Nat</TableHead>` and `<col>` width in the parent table headers (need to locate which page mounts `PlayerRow`'s table — RosterListView and any other consumers will get the new column header automatically since headers live with the row table).

c) **Team Modal → Roster tab** (`src/components/TeamModal.tsx`, line ~384-394 row template): extend the roster select to include `nationality`, then render a small round flag right after the player name (smaller than the FC/BC badge — `size="xs"`). No new column.

d) **Ballers.IQ Explain** (`supabase/functions/ai-coach/index.ts` + `src/lib/ballers-iq/promptBuilder.ts`):
- In the `ni-player` pack, add an optional `bio.nationality` field (string|null).
- Update the `ni-player` prompt template: add a sentence instructing the model to include a single short biographical line mentioning the player's country **only if `bio.nationality` is set**, and explicitly stating this is biographical context and MUST NOT influence `biq_rating`, `verdict`, or any score.

## 6. Out of scope (explicit)
- NBA players (no nationality field, no UI changes for them).
- Any rating, scoring, salary, or projection logic.
- Search/filter by nationality.
- Standings, schedule, charts, court view, scoring history.

## Technical notes
- Flag rendering uses unicode regional-indicator emojis → no new npm dependency, no asset pipeline.
- `nationality` column is nullable; all UI paths render `—` / nothing when null so NBA and any unmapped WNBA rows degrade gracefully.
- Country-name → ISO map lives in one file; "USA" and "United States" both resolve to 🇺🇸 in case the sheet drifts.
- Edge-function changes are additive (new field in payload), no breaking client contract.
