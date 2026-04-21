

## Plan: Fix NBAPlayDB URLs + inline By Game buttons

### Findings (from your own screenshots)

- **Player Matchup**: image-201 proves the URL `?defensivePlayers=Anthony%20Edwards&offensivePlayers=Luka%20Dončić` works perfectly — it lands on the **Matchups** filter with 55 results and both chips active. Our current URL also includes `actionplayer=…` and `q=…`, which forces the Play Filters tab and adds a noisy 3rd chip ("Actionplayer: Luka Dončić"). Fix: drop `actionplayer` and `q`; use only the two verified params.
- **By Game**: `?gamecode=20260412/CHIDAL` hits Cloudflare's bot-challenge page when opened from our app (referrer/headers differ from a human-navigated session). The `/games/{date}-{AWAY}{HOME}` pretty-URL form is more cache-friendly and the same one their own UI uses for direct game pages — it bypasses the search bot wall in most cases. Fix: make that the **primary** action and demote `gamecode=` to a secondary fallback.

### 1. `src/pages/AdvancedPage.tsx` — Player Matchup URL fix

Replace the URL in the matchup `Button.onClick` (line ~230):

```ts
const url =
  `https://www.nbaplaydb.com/search` +
  `?defensivePlayers=${encodeURIComponent(defensivePlayer)}` +
  `&offensivePlayers=${encodeURIComponent(offensivePlayer)}`;
open(url);
```

- Remove `actionplayer=…` and `q=…` entirely — they were the cause of landing on Play Filters.
- Update the helper line under the selectors to reflect reality:
  `Both players are applied as Matchup filters on NBAPlayDB.`

### 2. `src/pages/AdvancedPage.tsx` — By Game URL fix + inline buttons

#### 2a. Switch the primary action to the `/games/` pretty URL
The `/games/{yyyymmdd}-{AWAY}{HOME}` route is the canonical game page on NBAPlayDB and reliably renders without the bot challenge that hits `/search?gamecode=…`. Make it the primary button:

- Rename buttons:
  - **Primary**: `Open Game on NBAPlayDB ↗` → `https://www.nbaplaydb.com/games/${yyyymmdd}-${away}${home}` (e.g. `…/games/20260412-CHIDAL`).
  - **Secondary (ghost)**: `Search Plays ↗` → `https://www.nbaplaydb.com/search?gamecode=…` (kept because it sometimes works after the user has already passed Cloudflare in that browser session).
- Add a tiny note under the row when both URLs are enabled:
  `If "Search Plays" is blocked by a verification page, use "Open Game" — it loads the game page directly.`

#### 2b. Move the buttons inline with the selectors at the far right
Rework the layout (currently two rows):

```tsx
<div className="grid sm:grid-cols-[180px_1fr_auto] gap-3 items-end">
  {/* Game date */}
  {/* Game select */}
  <div className="flex items-center gap-2">
    <Button … >Open Game on NBAPlayDB ↗</Button>
    <Button variant="ghost" … >Search Plays ↗</Button>
  </div>
</div>
{/* gamecode hint moved to its own row below, right-aligned, mono */}
{!gameSearchDisabled && (
  <div className="text-[10px] font-mono text-muted-foreground text-right">{gamecode}</div>
)}
```

- Both buttons share `gameSearchDisabled` so they only enable once a game is picked.
- On mobile (single column), the third grid cell wraps under the selectors as a full-width row — same behavior as the Player Matchup tab.
- Remove the old `flex items-center gap-2 flex-wrap` row that previously hosted the buttons.

### Files touched
- `src/pages/AdvancedPage.tsx` — Player Matchup URL switched to `defensivePlayers + offensivePlayers` only; By Game gets a `/games/` primary URL plus a fallback `?gamecode=` ghost button; both buttons moved inline with the selectors at the far right.

### Verification
- `/advanced` → Player Matchup → Luka Dončić (off) + Anthony Edwards (def) → click `Open Matchup on NBAPlayDB` → opens `https://www.nbaplaydb.com/search?defensivePlayers=Anthony%20Don%C4%8Di%C4%87…` (your image-201 URL minus `actionplayer/q`) → page loads on the **Matchups** filter with both chips applied, no extra `Actionplayer` chip.
- `/advanced` → By Game → date `2026-04-12` → pick `Chicago Bulls @ Dallas Mavericks` → `Open Game on NBAPlayDB` opens `https://www.nbaplaydb.com/games/20260412-CHIDAL` (game page, no bot wall). `Search Plays` still attempts the `?gamecode=` URL for users who want the play-by-play search view.
- The Open / Search buttons now sit in the same row as the date + game selectors, far right; the `20260412/CHIDAL` mono badge moves to its own right-aligned row below.

