

## Fix Video Playback and Widen Video Container

### Problem
NBA.com blocks iframe embedding via `X-Frame-Options: SAMEORIGIN`. Both the in-row recap video and the modal tabs show blank/broken content (visible in the screenshots).

### Solution

**1. Replace iframes with clickable video thumbnails/links**

Since NBA.com content cannot be embedded in iframes, we need a different approach:

- **Game row recap container**: Replace the iframe with a styled "play" button card that opens the recap URL in a new browser tab. Show a play icon overlay on a dark placeholder with the "Game Recap" label.
- **NBA Game Modal**: Replace iframes with a full-size styled card per tab that opens the corresponding URL in a new tab when clicked. Each tab shows a large call-to-action button: "Open on NBA.com" with the appropriate icon.

**2. Widen the video/recap container**

- Change the recap container from `w-[320px]` to `w-[420px]` to give it more space.
- Reduce player name `max-w` from `120px` to `100px` and stat columns from `32px` to `28px` to reclaim space for the wider container.

### Files changed

| File | Action |
|------|--------|
| `src/components/ScheduleList.tsx` | Replace iframe with clickable "Watch Recap" card; tighten stat columns; widen container |
| `src/components/NBAGameModal.tsx` | Replace iframes with styled "Open on NBA.com" buttons per tab |

### Detail

**ScheduleList.tsx — GameBoxScore recap container**
- Grid columns: `grid-cols-[minmax(90px,1fr)_repeat(7,28px)]` (was 32px)
- Recap container: `w-[420px]` (was 320px)
- Replace `<iframe>` with a clickable card containing a Play icon + "Watch Recap" text that calls `window.open(recapUrl, '_blank')`

**NBAGameModal.tsx**
- Replace each tab's `<iframe>` with a centered card containing: the tab icon (large), "Open [Tab Name] on NBA.com" button
- Clicking the button calls `window.open(url, '_blank')`
- This ensures the content is always accessible regardless of NBA.com's embedding restrictions

