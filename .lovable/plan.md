

## Plan: Modal height fix, inline Game Recap, and Player Matchup search

### 1. AI Coach modal — give the Explain panel more vertical room
File: `src/components/AICoachModal.tsx` (line 212)

The dialog is currently capped at `max-h-[85vh]` and the Explain "scouting report" overflows on shorter viewports.

- Bump the dialog to `max-h-[92vh] h-[92vh]` so it claims most of the viewport on 13-15" laptops and the user can read the player header + summary + factor list + recommendation banner without scrolling.
- Increase `max-w-2xl` → `max-w-3xl` so the factor rows breathe horizontally. The other tabs (Analyze / Captain / Transfers / Injuries) gain space too at zero cost — they already render comfortably.
- Tighten the Explain inner spacing one notch (`space-y-3` → `space-y-2.5`, factor rows `py-2` → `py-1.5`) so the full report fits without internal scroll on a 1318×773 viewport (current preview).

### 2. `/schedule` Game Recap — play inline inside the game card
File: `src/components/ScheduleList.tsx` (`RecapCard` at lines 20-56, plus the boxscore wrapper at line 229)

NBA.com sets `X-Frame-Options: SAMEORIGIN`, so `https://www.nba.com/game/...` cannot be iframed directly. However, every recap video is also indexed on YouTube (column `youtube_recap_id`, already populated by the commissioner job) and YouTube embeds are CORS-friendly. Plan:

- Rework `RecapCard` to a small state machine:
  1. **YouTube available** (`youtube_recap_id` present): render the embed inline using `https://www.youtube-nocookie.com/embed/{id}?rel=0&modestbranding=1` inside an `<iframe>` that fills the existing `aspect-video` container. Add a tiny corner overlay link `Open on NBA.com ↗` (uses `game_recap_url`) so League Pass users still have one-click access to the official recap.
  2. **NBA.com only** (no YouTube id, but `game_recap_url` present): keep today's branded card UI but turn it into a **click-to-expand** affordance — clicking it swaps the placeholder for an `<iframe src={game_recap_url}>` with `referrerPolicy="no-referrer-when-downgrade"`. If the iframe load fails (detected via `onError`/blocked-frame fallback timer), the card auto-falls-back to opening the URL in a new tab and shows a small "Recap blocked from embedding — opened in new tab" notice. This satisfies "watch directly inside the card" whenever NBA.com permits it, and degrades gracefully when it doesn't.
  3. **Nothing available**: keep the existing "Official recap unavailable" placeholder.
- Pass `youtubeRecapId` into `<RecapCard>` from `GameBoxScore` (it's already on the parent — just thread it through). Same wiring for any other place that mounts `RecapCard`.
- No change to `PlayerModal`/`TeamModal` recap links — they remain quick external links inside compact rows; inline embedding only makes sense in the schedule's expanded boxscore panel where there's a dedicated 640-wide / `aspect-video` slot.

Net effect: when YouTube has the recap (the vast majority of FINAL games after the commissioner job runs), the user watches the video without leaving the page; otherwise we attempt the official NBA.com embed and only kick out to a new tab as a last resort.

### 3. `/advanced` NBA Play Search

#### 3a. By Game — restyle Away/Home selects to match the `/transactions` Team filter
File: `src/pages/AdvancedPage.tsx` (lines ~138-167)

Replicate the exact pattern used in `src/components/FiltersPanel.tsx` (lines 51-78): full team **name** as the visible label, with the team **logo as a watermark** on the right, opacity surge + scale on hover.

- Replace the current `<SelectItem value={t.tricode}>{t.tricode} — {t.name}</SelectItem>` with:
  ```tsx
  <SelectItem key={t.tricode} value={t.tricode}>
    <div className="relative flex items-center w-full gap-2 pr-10">
      <span>{t.name}</span>
      {logo && (
        <img src={logo} alt="" className="absolute right-0 w-10 h-10 opacity-20 hover:opacity-50 hover:scale-110 transition-all" />
      )}
    </div>
  </SelectItem>
  ```
- Apply to **both** Away and Home selects. URL composition (`gamecode = YYYYMMDD/AWAYHOME`) stays exactly as it is — the value is still the tricode. No other changes to the By Game tab.

#### 3b. Replace Tab 1 with "Player Matchup"
File: `src/pages/AdvancedPage.tsx` (entirely replace the `TabsContent value="player"` block, lines ~67-118; rename trigger label)

- Change the trigger from `🔍 By Player / Play` to `🏀 Player Matchup`.
- Pull the player roster from the same data source the other Advanced features use — `usePlayersQuery` hook (`src/hooks/usePlayersQuery.ts`), called with `{ limit: 1000 }` to get the entire pool. This is identical to how `AICoachModal` and `PlayerPickerDialog` source players, so no new fetcher is needed.
- Build two side-by-side searchable comboboxes (`grid sm:grid-cols-2 gap-3` on desktop, stacked on mobile) using the existing shadcn `Popover` + `Command` (`CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`) components — the same recipe `PlayerPickerDialog` already follows for searching players.
  - Left selector label: `OFFENSIVE PLAYER`, placeholder `Pick offensive player…`.
  - Right selector label: `DEFENSIVE PLAYER`, placeholder `Pick defensive player…`.
  - Each `CommandItem` shows the player photo (or initials), full name, FC/BC badge, and a faded team-logo watermark on the right (same visual pattern as the AI Coach Explain dropdown). Selection stores the player's full `core.name`.
  - Search filters case- and diacritic-insensitively (`normalize` helper, copied inline — strip combining marks).
- Buttons row:
  - Primary: `Open Matchup on NBAPlayDB ↗`. Disabled until both players are picked. On click:
    ```tsx
    window.open(
      `https://www.nbaplaydb.com/search?offensivePlayers=${encodeURIComponent(off)}&defensivePlayers=${encodeURIComponent(def)}`,
      "_blank", "noopener,noreferrer"
    );
    ```
  - Ghost: `Clear` — resets both selections.
- All state local (`useState`). No new files, no Supabase calls beyond `usePlayersQuery` (already in the hook layer). `Popover`, `Command`, `Button`, `Badge` are all already in the project.

### Files touched
- `src/components/AICoachModal.tsx` — bump `DialogContent` to `max-w-3xl max-h-[92vh] h-[92vh]`; tighten Explain inner spacing.
- `src/components/ScheduleList.tsx` — `RecapCard` becomes a 3-state inline player (YouTube embed / NBA.com iframe-with-fallback / placeholder); thread `youtubeRecapId` through `GameBoxScore`.
- `src/pages/AdvancedPage.tsx` — restyle Away/Home Selects in By Game tab to use full-name + watermark pattern; replace `By Player / Play` tab with a `Player Matchup` tab using `usePlayersQuery` + `Popover`+`Command` comboboxes; rename trigger label.

### Verification
- AI Coach → Explain → Neemias Queta on a 1318×773 viewport: full scouting report (header card + verdict + 5 factor rows + HOLD banner) is visible without inner scroll.
- `/schedule` → click any FINAL game → Recap panel auto-loads the YouTube video inline; play/pause works inside the card; small `Open on NBA.com ↗` link sits in the corner. For games with no `youtube_recap_id`, the NBA.com card stays clickable; if the inline iframe is blocked, the card opens NBA.com in a new tab and shows a notice.
- `/advanced` → NBA Play Search → By Game: Away/Home dropdowns show full team names with the team logo as a faded right-aligned watermark that surges on hover; URL behaviour unchanged.
- `/advanced` → NBA Play Search → Player Matchup: pick `Alperen Sengun` (offense) and `Rudy Gobert` (defense), click `Open Matchup on NBAPlayDB ↗` → opens `https://www.nbaplaydb.com/search?offensivePlayers=Alperen%20Sengun&defensivePlayers=Rudy%20Gobert` in a new tab. Clear resets both.

