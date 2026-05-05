## Fix share card preview photo + bottom chip wrap

### Problem analysis

**1) Photo missing in modal preview**
`BallersIQShareCard` only renders the `<img>` once `embeddedImage` (the data-URL produced by the async fetch + FileReader pipeline) resolves. If all CORS proxies fail (rate-limited, blocked, offline), `embeddedImage` stays `null` and we fall back to the "DS" initials block — which is exactly what the screenshot shows. The photo URL itself (`c.photo`) is fine; it's the proxy chain that silently fails.

The previous (working) version used the URL directly in the `<img>`. We regressed by gating the preview on the export-only data-URL.

**2) "RISK · LOW" chip wraps to two lines**
Footer chips have no `whitespace-nowrap`, so once the action chip + risk chip combine, the risk label wraps. Same root cause hits "PLAYER VERDICT" wrap risk on narrow renders, but that one is already nowrap.

### Fix

**`src/components/ballers-iq/share/BallersIQShareCard.tsx`**

- Always render an `<img>` for the preview using `embeddedImage ?? ctx.imageUrl` (with `referrerPolicy="no-referrer"` and `crossOrigin="anonymous"` for the direct URL). The initials block becomes a real fallback only when both are missing or `onError` fires.
- Keep the async embed pipeline; once a data URL resolves, swap `src` to it so the PNG export gets a same-origin image.
- Mark `data-photo-ready="1"` as soon as either (a) embedded data URL resolved, or (b) the direct `<img>` fired `onLoad` — so the modal export waits for *something* drawable rather than only the data-URL path.
- Add `whitespace-nowrap` to the footer action chip and risk chip spans.

**No changes** to `BallersIQShareCardModal.tsx` logic — its `data-photo-ready` polling already covers the new readiness signal. Export will still produce a clean PNG when the data URL is available; if only the direct URL loaded, html-to-image may taint the canvas and fall through to the existing `toJpeg` fallback (already in place).

### Regression test

Update `src/test/ballers-iq-share-card.test.tsx`:
- Assert the `<img>` is rendered immediately with a non-empty `src` (i.e. preview never blanks to initials when `imageUrl` is provided), in addition to the existing data-URL assertion that fires after the embed resolves.
- Assert the footer "Risk · LOW" span has `whitespace-nowrap` class so the chip never wraps.

### Files touched

- `src/components/ballers-iq/share/BallersIQShareCard.tsx` — preview falls back to direct URL, footer chips nowrap, readiness marker covers both paths.
- `src/test/ballers-iq-share-card.test.tsx` — extend regression coverage.