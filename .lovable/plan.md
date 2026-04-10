

## Fix: Special Characters Still Corrupted After Import

### Diagnosis
The current encoding detection relies on `\uFFFD` (replacement character) to decide whether UTF-8 decoding failed. However, some byte sequences that represent `č`, `ć`, `ž` in Windows-1250 may decode as **valid but wrong** UTF-8 characters (or valid Windows-1252 characters), so the fallback never triggers.

### Fix
**File**: `src/pages/CommissionerPage.tsx`

Replace the simple `\uFFFD` check with a smarter detection approach:

1. Decode as UTF-8
2. Check for **mojibake indicators** — common patterns that appear when Windows-1250 text is wrongly decoded as UTF-8 or Windows-1252 (e.g., `Ã¨`, `Ã¶`, `Å¡`, or the presence of C2/C3 byte sequences followed by specific bytes)
3. Also check for `?` appearing where accented characters are expected (some decoders silently replace unknown bytes with `?`)
4. If mojibake or corruption is detected, re-decode using Windows-1250

Additionally, add a **server-side safeguard** in `import-players/index.ts`: log the first few player names so encoding issues can be debugged from edge function logs.

### Concrete change

In `handleUpload` and `handleGameDataUpload`, replace the encoding block with:

```js
const buffer = await file.arrayBuffer();
const bytes = new Uint8Array(buffer);

// Try UTF-8 first
let text = new TextDecoder("utf-8").decode(buffer);

// Check if UTF-8 produced replacement chars OR if the file has
// high bytes (>127) that suggest a single-byte encoding
const hasReplacementChar = text.includes("\uFFFD");
const hasHighBytes = bytes.some(b => b > 127);
const hasMojibake = /[\u00c2\u00c3][\u0080-\u00bf]/.test(text);

if (hasReplacementChar || hasMojibake) {
  // File is not valid UTF-8, try Windows-1250 (Central European)
  text = new TextDecoder("windows-1250").decode(buffer);
}
```

This catches cases where the UTF-8 decoder doesn't produce `\uFFFD` but still produces garbled output from a Windows-1250 source file.

### After fix
Re-upload `NBA_dataset_full.tsv` on `/commissioner` with Full replace ON. Names like Nikola Jokić, Luka Dončić, and Nikola Vučević should display correctly.

### Files changed
| File | Action |
|------|--------|
| `src/pages/CommissionerPage.tsx` | Improved encoding detection with mojibake check |

