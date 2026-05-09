## Scope

Two narrow changes. No redesigns.

---

### 1) TOTW snapshot test (lock Starting 5 coordinates)

**File:** `src/test/court-formation.test.ts` (extend existing suite)

Add an explicit snapshot-style test that asserts `getRowPositions` returns the exact percentages the Starting 5 court (`RosterCourtView`) consumes:

- `getRowPositions(3, "28%")` → `[{top:"28%",left:"20%"}, {top:"28%",left:"50%"}, {top:"28%",left:"80%"}]`
- `getRowPositions(2, "72%")` → `[{top:"72%",left:"33%"}, {top:"72%",left:"67%"}]`
- `getRowPositions(2, "28%")` → `[{top:"28%",left:"33%"}, {top:"28%",left:"67%"}]`
- `getRowPositions(3, "72%")` → `[{top:"72%",left:"20%"}, {top:"72%",left:"50%"}, {top:"72%",left:"80%"}]`

Reason: locks the contract so any drift in row coordinates breaks the test before the visual ships. Existing `getCourtFormation` tests stay; this adds the lower-level snapshot.

---

### 2) Ballers.IQ sponsor sting on the entry slide

Goal: premium broadcast sponsor sting layered onto the existing `intro` slide. Entry slide layout (GW/date/games/deadline) stays exactly as it is.

#### 2a) Asset copies

- `user-uploads://NBA_BALLERSIQ-2.png` → `public/brand/sponsor-ballers-iq-nba.png`
- `user-uploads://WNBA_BALLERSIQ-2.png` → `public/brand/sponsor-ballers-iq-wnba.png`
- `user-uploads://FantasyCourt_BallersIQ-MALE.mp3` → `public/audio/FantasyCourt_BallersIQ-MALE.mp3`

(Female file ignored for now — male is the chosen voiceover per task.)

#### 2b) Entry slide visual addition — `src/components/court-show/CourtShowSlide.tsx`

Inside the `slide.payload.kind === "intro"` block, append (below the games/deadline row, inside the same centered flex column) a new `motion.div` containing:

- `<img>` of the league-specific sponsor logo, resolved via `useLeague().league` (`nba` → NBA file, `wnba` → WNBA file).
- Width `clamp(280px, 38vw, 520px)`, height auto, `object-contain`, `select-none`, `pointer-events-none`.
- Wrapper has subtle radial glow behind it: `bg-[radial-gradient(ellipse_at_center,rgba(245,200,80,0.18),rgba(40,90,180,0.12)_45%,transparent_70%)]` with rounded blur, sitting behind the logo via a sibling `absolute` div.
- Animation timeline (framer-motion, single component, sequenced via `transition.delay`):
  - Wrapper: `initial={{opacity:0, y:8}} animate={{opacity:0.95, y:0}} transition={{delay:1.2, duration:0.6, ease:"easeOut"}}`. Then a follow-up `transition` on `y` from 8 → 0 between 1.2s–1.8s is achieved by the same animate (single tween). Final opacity 0.95 (95%).
  - Inner shine sweep: an overlay `motion.div` with a diagonal white gradient (`bg-gradient-to-r from-transparent via-white/35 to-transparent`, skew-x-[-20deg], `mix-blend-overlay`), animated `x: ["-120%","120%"]`, `transition: { delay: 1.8, duration: 0.9, ease:"easeInOut" }`. Plays once. Clipped by `overflow-hidden` on the logo wrapper.
- GW title scale animation: wrap the existing `GW {gw}.{day}` div in a `motion.div` with `initial={{scale:0.98}} animate={{scale:1}} transition={{delay:0.8, duration:0.5, ease:"easeOut"}}`. No layout shift (transform only).

No "Brought to you by" text. No background change. No spin/bounce.

#### 2c) Voiceover playback — `src/components/court-show/useCourtShowAudio.ts`

Extend (don't replace) the existing hook so the bed continues to loop, and add a one-shot voiceover tied to the intro slide:

- New ref `voRef = useRef<HTMLAudioElement | null>(null)` and `voPlayedRef = useRef(false)`.
- Add a method `playIntroVO()` exposed from the hook return.
- Internals: lazy-create `new Audio("/audio/FantasyCourt_BallersIQ-MALE.mp3")`, `preload="auto"`, `volume = 0.9`. On `playIntroVO()`: if `enabled` and not yet played for this open session, call `play().catch(()=>{})` (autoplay-blocked is silent; user pressing play later will trigger it via the call site). Mark `voPlayedRef.current = true` only after `play()` resolves; otherwise keep flag false so manual play retries.
- When `active` flips to `false` OR `enabled` flips to `false`: `pause()`, reset `currentTime=0`, null the element. Reset `voPlayedRef.current = false` on `active=false` so reopens replay it.
- `toggle()` already controls mute. Add: if toggled to disabled while VO is playing, pause and reset it.

#### 2d) Trigger from modal — `src/components/court-show/CourtShowModal.tsx`

- After `current` is computed, add an effect:
  ```
  useEffect(() => {
    if (!open || !current) return;
    if (current.payload.kind === "intro") {
      const t = setTimeout(() => audio.playIntroVO(), 300); // 0.3s delay per spec
      return () => clearTimeout(t);
    }
  }, [open, current?.payload.kind, audio]);
  ```
- On user pressing the play button while the intro slide is current and VO hasn't fired (autoplay-blocked path), the same effect re-fires only if dependencies change — to cover that case, also call `audio.playIntroVO()` from the existing play/pause toggle handler when `current?.payload.kind === "intro"` and `!playing → playing`.

#### 2e) Cleanup guarantees

- Modal close (`open=false`) → hook's existing `active=false` cleanup tears down both bed and VO.
- Slide change away from intro → VO continues playing if already started (it's a short sponsor read); does NOT restart. If user navigates back to intro within the same open session, VO does not replay (one-shot per open).
- Speed/fullscreen toggles do not affect VO.

---

### Out of scope

- Female voice variant
- Any change to non-intro slides
- New visible "Brought to you by" copy
- Background, court texture, GW typography, header chrome
- Any business logic / data fetches

---

### Acceptance criteria

- `vitest run` passes the new `getRowPositions` snapshot test alongside existing TOTW tests.
- Opening the Daily Court Show on intro slide:
  - Existing GW/date/games/deadline block unchanged.
  - At ~0.8s GW title subtly scales to 1.
  - At ~1.2s league-correct Ballers.IQ logo fades in below deadline row, settles at ~95% opacity.
  - At ~1.8s a single shine sweep crosses the logo.
  - VO plays once at ~0.3s if audio enabled; mute button silences it; closing/reopening modal allows replay; navigating away then back does not replay within same session.
- NBA team → NBA logo. WNBA team → WNBA logo.
- No console errors when autoplay is blocked.
