

## Replace "Watch Recap" Button with Iframe + Fallback

### What changes

**`src/components/ScheduleList.tsx`** — single file edit:

1. **Add `RecapVideoEmbed` component** (as specified in the request) above `GameBoxScore`. It renders an iframe from `game_recap_url` with autoplay/fullscreen permissions, plus an "Open on NBA.com" fallback link below. If `url` is null, shows a "Recap unavailable" placeholder.

2. **Replace the current recap container** (lines 135-146) — swap the `<button>` that just opens a new tab with the new `RecapVideoEmbed` component. Keep the `w-[420px]` container width but use the iframe-based embed inside it.

3. **Iframe error resilience** — add an `onError` handler on the iframe that hides it and shows the fallback CTA instead. Also wrap in a state-based approach: if the iframe fails to load (via `onError` or a timeout), toggle to a fallback view with the play button + "Open on NBA.com" link, so the layout never breaks.

4. **Show container even without recap** — when `recapUrl` is missing, still render the right column with the "Recap unavailable" placeholder (instead of hiding it entirely), keeping the layout consistent.

### Files changed
| File | Action |
|------|--------|
| `src/components/ScheduleList.tsx` | Add `RecapVideoEmbed`, replace button with iframe+fallback in `GameBoxScore` |

