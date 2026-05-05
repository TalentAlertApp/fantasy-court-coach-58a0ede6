# Daily Court Show — Polish Pass

Three focused changes, all scoped to `src/components/court-show/*`. No DB, no schema, no changes to `SchedulePage` structure.

## 1) Smarter autoplay + clean close behavior

**File:** `CourtShowModal.tsx`

- Manual navigation (Prev/Next buttons, ArrowLeft/ArrowRight keys) now **pauses autoplay**: each handler calls `setPlaying(false)` in addition to advancing the index. The user resumes by hitting the Play button (already wired) or Space.
- Autoplay continues to resume automatically after the user un-pauses; no auto-resume after a manual jump (per spec: "resume only when appropriate" = explicit user action).
- Hover-pause logic stays unchanged.
- Reset on open: keep current `useEffect` that resets `index=0`, `playing=true` when `open` flips true. Add a guard so the reset does **not** fire when only `gw`/`day` props change while the modal is already open mid-show (prevents jarring restart if SchedulePage re-renders).
- Closing: modal is a Radix `Dialog` overlay — `/schedule` route, scroll position, gw/day selection and all underlying state are untouched today. Verified. Plan adds a comment noting this contract and ensures we do **not** call `navigate()` or change URL on close.

## 2) Outro arrow → /MY ROSTER

**Files:** `CourtShowSlide.tsx`, `CourtShowModal.tsx`

- Add an optional `onOutroAction?: () => void` prop on `CourtShowSlide`.
- In the `outro` branch, wrap the existing pulsing `ArrowRight` in a `<button>` with `aria-label="Go to My Roster"`, hover lift, that calls `onOutroAction`. Works for both played-day and upcoming-day variants (single outro slide for both).
- `CourtShowModal` passes `onOutroAction={() => { onOpenChange(false); navigate('/'); }}` using `useNavigate` from `react-router-dom`. (`/` is the My Roster route per the existing `RosterPage` mapping in `App.tsx` — verified earlier in session memory.)

## 3) Contextual ambient sound (royalty-free) + mute toggle

**Approach (zero rights risk):** generate the audio in-browser with the Web Audio API. Nothing is downloaded, nothing is licensed, nothing is shipped as an asset — purely procedural tones. This is the cleanest way to guarantee no IP exposure.

**New file:** `src/components/court-show/useCourtShowAudio.ts`

A small hook that owns an `AudioContext` and builds a soft "broadcast intro" bed:

- 2 detuned sine oscillators at A2/E3 through a low-pass filter (cutoff ~600Hz) → gentle pad.
- A slow LFO on a gain node for subtle swell (very low volume, master gain ~0.05).
- Optional short shimmer triggered on slide change (sine blip at C5, 120ms, gain 0.03) — adds the "broadcast cue" feel without being intrusive.
- API: `{ enabled, toggle, onSlideChange }`. `enabled` defaults to `true` but is read from `localStorage["courtshow.audio"]` so the user's mute preference persists across sessions and across opens. Auto-starts on mount only if `enabled`. Stops + closes context on unmount or when `enabled` flips to false. Resumes context on first user gesture inside the modal (Safari requirement) — modal-open click counts.

**Wire in `CourtShowModal.tsx`:**

- Instantiate `useCourtShowAudio()` only while `open` is true.
- Call `audio.onSlideChange()` inside the existing slide-advance `useEffect` and in manual nav handlers.
- **Mute icon top-right:** add a button next to the existing `X` close button. Uses `Volume2` / `VolumeX` from `lucide-react`. Tooltip: "Mute sound" / "Unmute sound". Same styling as the close button.
- Icon is context-sensitive (reflects current `enabled` state). Click toggles and persists preference.

## Acceptance

- Pressing Prev/Next or arrow keys halts autoplay; only Play button or Space resumes it.
- Closing the modal returns to the exact same `/schedule` view (route, scroll, gw/day filters preserved). Re-opening starts from slide 1.
- Outro arrow navigates to `/` (My Roster) and closes the modal.
- Sound starts softly when the modal opens; mute icon appears top-right; toggling persists across opens; no external audio files are bundled or fetched.

## Files touched

- `src/components/court-show/CourtShowModal.tsx` (autoplay pauses on manual nav, navigate to /, mute button, audio hook integration)
- `src/components/court-show/CourtShowSlide.tsx` (outro arrow becomes button with `onOutroAction`)
- `src/components/court-show/useCourtShowAudio.ts` (new, ~80 lines, Web Audio API only)
