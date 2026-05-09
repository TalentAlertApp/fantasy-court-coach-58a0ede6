Plan:

1. Fix Team of the Week court positioning
- Correct `TeamOfTheWeekModal` formation selection so both valid Starting 5 shapes render all 5 players:
  - `3FC + 2BC`
  - `2FC + 3BC`
- Keep using the shared court coordinate helper, but add a Team of the Week presentation offset that shifts the formation left inside the wider modal court so players are visually centered and not clipped.
- Add/adjust tests to lock this behavior:
  - `getRowPositions` remains the exact Starting 5 coordinate snapshot.
  - Team of the Week formation returns 5 players for both 3FC+2BC and 2FC+3BC.
  - Team of the Week visual coordinates apply the left offset consistently without changing the Starting 5 source coordinates.

2. Replace the flat entry-slide sponsor logo with a reusable 3D badge component
- Create a focused `RotatingBallersIQBadge` component for the Fantasy Court Daily intro slide.
- Use the uploaded front artwork as the front face:
  - NBA teams: `NBA_BALLERSIQ_front.png`
  - WNBA teams: `WNBA_BALLERSIQ_front.png`
- Preserve the existing entry slide layout: title, GW, date, games/deadline row stay in the same structure.
- Place the badge centered below the games/deadline row, above controls, with a subtle uppercase “Powered by” caption.

3. Build the premium 3D object treatment with CSS 3D transforms
- Use `perspective`, `transform-style: preserve-3d`, `backface-visibility`, and GPU-friendly transforms.
- Continuous restrained Y-axis rotation: front → side → back → side → front.
- Hover pauses rotation.
- Add physical depth:
  - visible metallic edge/thickness
  - beveled rounded corners
  - chrome/blue edge highlights on the front
  - soft bloom/glow and cinematic shadow
  - animated reflective sheen synchronized with rotation
- Keep the badge width around `420–520px` on desktop and scale down cleanly on smaller modal widths.

4. Construct the new gold back card in code
- Build the back face as a CSS/SVG-styled metallic plate, not a flat screenshot.
- Visual details:
  - clean uniform brushed gold metal background
  - rounded metallic corners
  - embossed Ballers.IQ wordmark
  - embossed NBA or WNBA text depending on league
  - red square accent before “IQ”
  - no dot after NBA/WNBA
  - no vertical gold strip/light split
  - dark gold shadows and polished highlights

5. Refine the existing voiceover/audio integration without changing controls
- Keep current play/pause/mute controls.
- Ensure global mute also mutes the intro voiceover.
- Keep one-shot intro playback per modal open.
- If autoplay is blocked, fail safely and allow playback when the user presses Play.
- Leave the existing slideshow layout and non-intro slides untouched.

6. Validate
- Run the relevant unit tests for court formation/TOTW positioning.
- Verify the component compiles through the normal project checks.
- Visually verify the intro slide structure remains recognizable and the badge is centered, restrained, and non-overcrowded for NBA and WNBA asset selection.