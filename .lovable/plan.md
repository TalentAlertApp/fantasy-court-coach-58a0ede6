

## Fix: Force Reliable Encoding Detection with `fatal: true`

### Root Cause
The current encoding detection uses `text.includes("\uFFFD")` and a mojibake regex after a non-fatal UTF-8 decode. For this specific file, neither check triggers — likely because the byte sequences decode to valid (but wrong) UTF-8 codepoints that don't match the mojibake pattern. The result: the file is treated as UTF-8, and bytes for `ć`, `č`, `ž` are silently replaced with `?`.

### Fix
**One file**: `src/pages/CommissionerPage.tsx`

Replace the encoding detection in both `handleUpload` and `handleGameDataUpload` with a **strict UTF-8 decode** using `fatal: true`. If the file contains any invalid UTF-8 byte, the decoder throws instead of silently replacing — guaranteeing we fall back to Windows-1250.

```js
const buffer = await file.arrayBuffer();
let text: string;
try {
  text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
} catch {
  // Not valid UTF-8 → use Windows-1250 (Central European)
  text = new TextDecoder("windows-1250").decode(buffer);
}
```

This is simpler, more robust, and eliminates the possibility of silent misdetection.

Additionally, add a `console.log` with the first 3 player names after parsing so any remaining issues can be debugged from the browser console.

### After fix
Re-upload `NBA_dataset_full.tsv` on `/commissioner` with Full replace ON. Names like Nikola Jokić, Luka Dončić, and Nikola Vučević should display correctly.

### Files changed
| File | Action |
|------|--------|
| `src/pages/CommissionerPage.tsx` | Use `fatal: true` UTF-8 decode with Windows-1250 fallback |

