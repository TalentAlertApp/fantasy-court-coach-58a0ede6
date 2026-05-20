## 1) Premium "Ballers.IQ" Intro Screen after ENTER COURT

The "ENTER COURT" button lives in `WelcomeBackHero` (rendered by `RequireAuth`), not in onboarding proper. Today, clicking it just dismisses the hero. I'll inject a full-screen cinematic intro between that click and the user landing on `/` (MY ROSTER).

### Behavior
- Click "Enter Court" → render a full-viewport overlay (`fixed inset-0 z-[100]`) on top of the app background.
- Background fills with the active theme's `bg-background` so it matches dark/light.
- Open with a **broken-glass shatter-in transition**: ~14 angular SVG glass shards start scattered/scaled+rotated with low opacity, then converge into a perfect rectangle covering the screen (~700ms, staggered). After convergence the shards fade and the BallersIQ card "settles in" with a small spring scale.
- Single centered element: a 3D rotating card with two faces, reusing the **exact same `RotatingBallersIQBadge`** component used in the Daily Court Show — same artwork (`/brand/ballers-iq-card-front-nba.png` / `/brand/ballers-iq-card-front-wnba.png`), same back-face metallic plate, same continuous Y-axis rotation, same hover-to-pause behavior.
- League selection: read from `useLeague()` (which already maps to the active MY ROSTER team's sport) — NBA front for NBA teams, WNBA front for WNBA teams.
- Size: pass `width = Math.round(480 * 1.2) = 576` to `RotatingBallersIQBadge` (the component already derives height from a fixed aspect ratio, so it scales correctly — 20% bigger than the default).
- Audio: play the league-matched VO on mount.
  - NBA team → `HoopsFantasy_BallersIQ-MALE.mp3`
  - WNBA team → `HoopsFantasy_BallersIQ-FEMALE.mp3`
  - Respect the existing `courtshow.audio.enabled` localStorage mute pref (same key used by Court Show + onboarding bed), so a muted user gets silence.
- Auto-dismiss after **5 seconds**, OR immediately on any click/keypress/Escape. Dismiss = fade out (200ms) → unmount overlay → user is on `/` (MY ROSTER).
- Show a subtle "Tap anywhere to skip" hint at the bottom in muted foreground tone.

### Where it hooks in
- New component: `src/components/welcome-back/BallersIQEntryIntro.tsx`
  - Props: `onDone: () => void`.
  - Owns the shatter animation (Framer Motion), the rotating card, the audio playback, the 5s timer, and click-to-skip.
- New audio assets (copied from the uploads):
  - `public/audio/HoopsFantasy_BallersIQ-MALE.mp3`
  - `public/audio/HoopsFantasy_BallersIQ-FEMALE.mp3`
- `RequireAuth.tsx`: instead of immediately running the post-Enter side effects, set a local `showEntryIntro` state. Render `<BallersIQEntryIntro onDone={…} />` while it's true; `onDone` runs the existing cleanup (`markWelcomeBackSeenThisSession`, `clearLastSignOut`, `setWelcomeOpen(false)`, query-param strip) and unmounts the overlay, revealing `/`.
- Keep `RotatingBallersIQBadge` imported from its existing path; no changes to that component.

### Technical notes
- Shatter uses a single SVG with ~14 `<polygon>` shards arranged in a Voronoi-ish layout; Framer Motion animates each shard from a random `{x, y, rotate, scale, opacity}` to `{0,0,0,1,1}` with a staggered children transition.
- Theme-aware background: `bg-background` token (already HSL-driven for dark/light).
- Pointer/keyboard listeners attached on overlay mount, cleaned up on unmount.
- Respect `prefers-reduced-motion`: skip the shatter, just fade in.

## 2) Manual Pick Player — remove containers around the 4 top KPI icons

In `src/components/PlayerPickerDialog.tsx` (the manual pick screen used during draft + roster swap), the top row renders 4 KPI tiles (PICKED, BANK, FC, BC) via a small internal component around line 454–490, each icon currently wrapped in a colored rounded square container.

- Edit only that icon-container element on each of the 4 tiles: remove the wrapper `div`'s background, border, padding, and rounded styling, so the lucide icon (`Users`, `Wallet`, `ShieldHalf`, `Target`) renders bare, inheriting just its color token.
- Keep icon size, label text, value text, and the outer tile card unchanged.
- No other tiles in the app are touched.

## Out of scope
- No changes to onboarding `DraftPicker`, no changes to `RotatingBallersIQBadge` internals, no changes to the Daily Court Show.
- The two MP3s already in the project (`FantasyCourt_BallersIQ-*.mp3`) are untouched; the new `HoopsFantasy_BallersIQ-*.mp3` files are added separately and used only by the new intro.