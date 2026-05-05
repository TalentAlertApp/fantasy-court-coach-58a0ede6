# Plan — Court Show audio cleanup + Ballers.IQ UI consolidation

## A) Court Show audio: proper pause/stop + listener cleanup

**File:** `src/components/court-show/useCourtShowAudio.ts`

Issues today:
- The dual `useEffect` (one lifecycle + one unmount) both call `stopBed` but the audio element is created lazily and never gets explicit `removeEventListener` / source detach.
- When the modal closes mid-loop, autoplay-blocked play promise rejections silently fail and the element can be left attached.
- `audioRef.current = null` happens only on full unmount, not when modal toggles closed → next open creates a fresh element each time but old one isn't fully torn down if play() promise was still pending.

Changes:
1. Track the in-flight `play()` promise in a ref; on stop, await/cancel it before pausing to avoid `AbortError` warnings.
2. Add `pause`/`ended`/`error` listeners on the audio element only for diagnostics, and remove them in cleanup.
3. Collapse the two effects into one: when `active && enabled` → start; otherwise → stop. On cleanup (effect re-run or unmount): pause, reset `currentTime`, remove listeners, set `src = ""`, and null out `audioRef.current`. This guarantees a clean teardown every time the modal closes (active flips false), not only on full unmount.
4. Also stop on `document.visibilitychange` → hidden, resume when visible if still active+enabled. Listener properly removed on cleanup.
5. Keep `loop = true`, `volume = 0.35`, `localStorage` mute pref, and the existing `{ enabled, toggle, onSlideChange }` API — no consumer changes needed.

**File:** `src/components/court-show/CourtShowModal.tsx` (verify only)
- Confirm `useCourtShowAudio(open)` is called with the modal-open boolean so the new cleanup fires on close. No code change expected unless it's currently passing something else.

## B) Ballers.IQ UI consolidation (anti-clutter pass)

### B1. Audit results — duplicated entry points to remove

- `src/App.tsx` route `/ai` → `AIHubPage`. `AIHubPage.tsx` is a near-duplicate of `AICoachModal` (same 5 actions, lower-fidelity UI). It is not linked from the sidebar but the route exists.
  - **Action:** delete `src/pages/AIHubPage.tsx` and remove the `/ai` route + import in `App.tsx`. `AICoachModal` becomes the single Ballers.IQ control center.
- `src/pages/PlayersPage.tsx` line ~532: small "AI Coach" pill button.
  - **Action:** rename label to "Ballers.IQ" and swap the `Bot` icon for `<BallersIQBrand variant="emblem" size="sm" />`. Keep it — it's the page's single entry point.
- `src/pages/RosterPage.tsx`: already uses Ballers.IQ wordmark for the modal trigger ✓ (one entry point — keep).
- `src/pages/ScoringPage.tsx`: Ballers.IQ Recap toggle is content, not a duplicate AI Coach trigger ✓ (keep).
- `src/pages/SchedulePage.tsx`: `BallersIQTicker` is inline content, no AI Coach button ✓ (keep).
- `src/pages/TeamsPage.tsx`: `StandingsBallersIQ` is a content panel, not a CTA ✓ (keep).
- `PlayerModal`, `PlayerCompareModal`, `TeamModal`: spot-check that they don't open AI Coach separately. If they have an "Explain" button, leave it (it's contextual and routes into the same modal's Explain tab) — only remove if it's a literal duplicate of the page-level button.

### B2. AICoachModal stays as the control center

No structural change. Tabs Analyze / Captain / Transfers / Injuries / Explain remain. Header already shows `BallersIQBrand` wordmark ✓.

Minor: ensure the `DialogTitle` says "Ballers.IQ" (currently `sr-only`). Add a visible `<span class="sr-only">` is fine; visible header already shows wordmark.

### B3. Naming pass

- Tooltip/aria changes only — no new visible text:
  - `PlayersPage.tsx` line 532-534: `title="Open AI Coach"` → `title="Open Ballers.IQ"`, label "AI Coach" → "Ballers.IQ".
  - Keep "AI Coach" as fallback aria-label only where Ballers.IQ wordmark image is the visible affordance and screen readers need the function name.

### B4. Tabs unchanged

Analyze / Captain / Transfers / Injuries / Explain — keep, no additions.

### B5. `BallersIQBrand.tsx` theme detection fix

Current bug (lines 22-30): the initial state and the MutationObserver both `|| true` at the end → **always returns dark**, breaking light mode and `themeAware=false`.

Fix `useIsDark`:
```ts
const [dark, setDark] = useState<boolean>(() => {
  if (typeof document === "undefined") return true;
  if (document.documentElement.classList.contains("dark")) return true;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
});
useEffect(() => {
  const obs = new MutationObserver(() => {
    setDark(document.documentElement.classList.contains("dark"));
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}, []);
```

`forceTheme` precedence already correct in `themeSuffix = forceTheme ?? (themeAware ? ... : "dark")` — preserved.

### B6. Visual usage standard (documented, applied where wrong)

Add a top-of-file JSDoc block to `BallersIQBrand.tsx`:
- `wordmark` → modal headers, page headers
- `emblem` → compact cards, inline buttons
- `appIcon` → launch/action tiles only
- `badge` → premium insight cards, sparingly

Audit existing usages and fix outliers:
- `RosterPage.tsx` line 542: `emblem` inside an inline toggle ✓
- `RosterPage.tsx` line 447-448: `wordmark` inside a button trigger — acceptable (page-level entry)
- `PlayersPage.tsx` after rename: switch to `emblem` size="sm" inside the small pill (compact card pattern)
- `TeamsPage.tsx` line 256-258: decorative emblem watermark ✓

No other usages need changes.

## Files touched

- `src/components/court-show/useCourtShowAudio.ts` — single effect, listener cleanup, visibility handling
- `src/components/ballers-iq/BallersIQBrand.tsx` — fix forced-dark bug, add usage JSDoc
- `src/App.tsx` — remove `/ai` route + import
- `src/pages/AIHubPage.tsx` — **delete**
- `src/pages/PlayersPage.tsx` — rename "AI Coach" → "Ballers.IQ", swap icon to emblem

## Acceptance verification

- Open Daily Court Show → close → no orphan audio, no console warnings, no AbortError.
- Toggle browser tab → audio pauses; return → resumes if still open.
- Toggle `<html class="dark">` off → light wordmark/emblem assets load.
- `/ai` no longer routable; `AICoachModal` is the only Ballers.IQ hub.
- Players page button reads "Ballers.IQ"; Roster page trigger unchanged; no new top-level buttons added anywhere.
