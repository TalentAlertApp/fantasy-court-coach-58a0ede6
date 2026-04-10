
## Fix special-character imports permanently

### What I confirmed
- This is not a sorting issue and not a `/players` rendering issue.
- The `/players-list` API response already contains corrupted names like `Nikola Joki?` and `Luka Don?i?`, so the bad value is already in Supabase before React renders it.
- `public/data/Database.csv` in the repo contains the correct names (`Jokić`, `Vučević`, `Dončić`), so the app can handle Unicode fine.
- `import-players` and `players-list` both pass `name` through as-is; they are not repairing corruption.
- `import-game-data` does not overwrite existing player names for known players, so the main problem is the player upload path.

### Do I know what the issue is?
Yes: the upload/import pipeline is saving already-corrupted player names into `players.name`. The repeated decoder swaps were still guesswork. The permanent fix needs two things:
1. inspect the real bytes of the uploaded TSV, and
2. make the importer refuse or protect against corrupted names before they hit the database.

### Implementation plan
1. **Inspect the actual uploaded TSV bytes**
   - In default mode, inspect the real uploaded file bytes around names like Jokić/Vučević/Dončić.
   - Determine whether the file is:
     - valid UTF-8,
     - Windows-1250 / ISO-8859-2,
     - another legacy encoding,
     - or already damaged with literal `?` bytes.
   - This decides the real decoder instead of another blind fallback.

2. **Harden the Commissioner upload UI**
   - Update `src/pages/CommissionerPage.tsx`.
   - Add an explicit encoding selector: `Auto`, `UTF-8`, `Windows-1250`, `Windows-1252`, `ISO-8859-2`.
   - Add a preview of the first few parsed names before committing import.
   - If previewed names contain suspicious characters (`?` or `�`), block or strongly warn before full replace.

3. **Add import safety on the server**
   - Update `supabase/functions/import-players/index.ts`.
   - Before upsert, load existing player names by `id`.
   - If an incoming name looks corrupted but the existing DB name is clean, preserve the clean DB value instead of overwriting it.
   - Log/count suspicious rows so future bad uploads are easy to detect.

4. **Repair the currently corrupted data**
   - After the byte check, either:
     - re-upload the TSV with the correct decoder selected, or
     - run a targeted repair by player ID if the source file is already damaged.
   - Then verify the fixed names in API output, not just the UI.

### Technical details
```text
Current flow:
TSV upload -> CommissionerPage decode/parse -> import-players -> players table -> players-list -> /players

Confirmed bad point:
players-list response already returns "Joki?" / "Don?i?"
```

**Files to change**
- `src/pages/CommissionerPage.tsx`
- `supabase/functions/import-players/index.ts`

**Files likely not needing changes**
- `src/pages/PlayersPage.tsx`
- `src/components/PlayerRow.tsx`
- `supabase/functions/players-list/index.ts`

### Verification after implementation
- Re-upload from `/commissioner`.
- Confirm preview shows `Nikola Jokić`, `Nikola Vučević`, `Luka Dončić`.
- Confirm `/functions/v1/players-list?...` returns the correct Unicode names.
- Confirm `/players` shows the same names end-to-end.