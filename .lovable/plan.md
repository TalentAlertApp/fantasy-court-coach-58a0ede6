

## Fix: Central European Characters (č, ć, ž, etc.)

### Root cause
Characters like **č**, **ć**, **ž** (Jokić, Vučević, Dončić) are Central/Eastern European and do NOT exist in Windows-1252 or ISO-8859-1. They exist in **ISO-8859-2** (Latin-2) or **Windows-1250**. The current fallback decodes with `windows-1252`, which maps these bytes to `?`.

### Fix
**One file**: `src/pages/CommissionerPage.tsx`

Update the encoding detection in `handleUpload` (and `handleGameDataUpload`) to try multiple encodings:

```js
const buffer = await file.arrayBuffer();
let text = new TextDecoder("utf-8").decode(buffer);
if (text.includes("\uFFFD")) {
  // Try Windows-1250 (Central European) first, then fall back to Windows-1252
  const w1250 = new TextDecoder("windows-1250").decode(buffer);
  text = w1250.includes("\uFFFD")
    ? new TextDecoder("windows-1252").decode(buffer)
    : w1250;
}
```

This ensures characters like č, ć, ž, š, ď are correctly decoded from Central European encoded files.

### After fix
Re-upload `NBA_dataset_full.tsv` on `/commissioner` with Full replace ON. Names like Nikola Jokić and Nikola Vučević will display correctly.

### Files changed
| File | Action |
|------|--------|
| `src/pages/CommissionerPage.tsx` | Try Windows-1250 before Windows-1252 fallback |

