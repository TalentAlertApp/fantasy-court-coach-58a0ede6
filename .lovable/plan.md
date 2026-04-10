
Goal: stop relying on re-import decoding and directly repair the live player records the app is actually rendering.

What I confirmed
- The UI reads player names from Supabase `players.name`, not from the uploaded file directly.
- The live database is still wrong for the affected rows (for example `203999 -> Nikola Joki?`, `202696 -> Nikola Vu?evi?`).
- `public/data/Database.csv` already has the correct spellings for those same IDs, so the repo dataset is fine; the stored Supabase data is what needs patching.

Plan
1. Use `public/data/Database.csv` as the canonical source
   - Build an ID → correct name map from the local dataset.
   - Use that map instead of hand-typing names, so there are no manual typos.

2. Patch the live `players` table directly
   - Update only rows whose current `players.name` contains `?` and whose ID exists in `Database.csv`.
   - This will cover the known broken rows such as:
     - 203999 Nikola Jokić
     - 202696 Nikola Vučević
     - 1631107 Nikola Jović
     - 1642260 Nikola Topić
     - 1629029 Luka Dončić
     - plus the other currently corrupted names already visible in the DB

3. Keep this fix narrow
   - No new UI work for this request.
   - No schema migration needed.
   - No change to roster/game tables, because display names come from `players`.

4. Verify end to end
   - Re-check the corrected IDs in `players`.
   - Re-check `/functions/v1/players-list` for those IDs.
   - Confirm `/players` and roster views now show the corrected names.

Technical note
- This is a data repair, not a parsing refactor.
- The local dataset file is already correct; the live Supabase `players` rows are the only part that must be changed.
- Because the app’s normal flows use player IDs, patching `players.name` directly is the shortest reliable fix for the current issue.
