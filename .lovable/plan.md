

## Fix: Special Characters in Player Names (Encoding Issue)

### Problem
Player names with diacritics (Vučević, González, Dončić, Jokić, etc.) are stored as garbled text (`Vu?evi?`, `Gonz�lez`) because the browser's `file.text()` assumes UTF-8, but the TSV file is encoded in Windows-1252 (or Latin-1).

### Fix
**One file change**: `src/pages/CommissionerPage.tsx`

In `handleUpload`, replace:
```js
const text = await file.text();
```
with encoding detection that tries UTF-8 first, and falls back to Windows-1252:
```js
const buffer = await file.arrayBuffer();
// Try UTF-8 first; if it produces replacement chars, fall back to windows-1252
let text = new TextDecoder("utf-8").decode(buffer);
if (text.includes("\uFFFD")) {
  text = new TextDecoder("windows-1252").decode(buffer);
}
```

Apply the same fix to `handleGameDataUpload` for consistency.

### After deployment
Re-upload your `NBA_dataset_full.tsv` on `/commissioner` — names like Nikola Vučević, Hugo González, Luka Dončić will import correctly.

### Files changed
| File | Action |
|------|--------|
| `src/pages/CommissionerPage.tsx` | Add encoding detection for TSV/CSV file reads |

