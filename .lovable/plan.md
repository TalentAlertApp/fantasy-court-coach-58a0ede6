

## Plan: Matchup URL fix + tab styling + arrow polish

### 1. Player Matchup URL — guarantee all 3 params reach NBAPlayDB
File: `src/pages/AdvancedPage.tsx` (`handleMatchupOpen`, ~line 200)

The current code already builds `?actionplayer=…&defensivePlayers=…&offensivePlayers=…`, but the landed URL shows only `actionplayer`. Two likely culprits:
- `window.open(url, "_blank", "noopener,noreferrer")` — the third arg `"noopener,noreferrer"` is a feature string in some browsers (Safari, certain Chrome configs) and can interact oddly with long query strings opened from a click handler that also performs an async clipboard write.
- NBAPlayDB's landing page may rewrite the URL on first paint. We can't change their server behavior, but we CAN make sure the request leaving our app contains all params.

Fix:
- Build the URL FIRST, open it BEFORE the awaited clipboard call so the browser's user-gesture window is intact:
  ```ts
  const handleMatchupOpen = () => {
    const params = new URLSearchParams({
      actionplayer: offensivePlayer,
      defensivePlayers: defensivePlayer,
      offensivePlayers: offensivePlayer,
    });
    const url = `https://www.nbaplaydb.com/search?${params.toString()}`;
    window.open(url, "_blank"); // drop the rel string — modern browsers default to noopener for _blank
    // Fire-and-forget clipboard + toast (non-blocking)
    navigator.clipboard?.writeText(defensivePlayer).catch(() => {});
    toast.success("Opening NBAPlayDB", {
      description: `Filters: ${offensivePlayer} (off) + ${defensivePlayer} (def). Defender copied to clipboard.`,
    });
  };
  ```
- Use `URLSearchParams` so encoding is bulletproof for diacritics (Dončić, Sengün) and removes any chance of double-encoding.
- Drop `async/await` from the click — the awaited clipboard call was happening BEFORE `open`, but even if `open` runs first, an async function flagged the click handler in a way that consumed the user gesture token in some browsers.

### 2. Tabs: equal width, centered, wider
File: `src/pages/AdvancedPage.tsx` (`<TabsList>`, line 231)

Current `<TabsList>` is left-aligned with intrinsic-sized triggers. Make the two tabs symmetric and centered:
```tsx
<TabsList className="rounded-lg grid grid-cols-2 w-full max-w-md mx-auto">
  <TabsTrigger value="matchup" className="font-heading text-xs uppercase rounded-lg">🏀 Player Matchup</TabsTrigger>
  <TabsTrigger value="game" className="font-heading text-xs uppercase rounded-lg">🏀 By Game</TabsTrigger>
</TabsList>
```
- `grid grid-cols-2` → both tabs share the row equally.
- `w-full max-w-md mx-auto` → tabs are noticeably wider than today and horizontally centered within the card.

### 3. By Game date arrows: borderless, smaller
File: `src/pages/AdvancedPage.tsx` (date-cell buttons, lines 283-301)

Switch the chevron buttons from `variant="outline"` (which renders the bordered yellow primary outline) to `variant="ghost"` and shrink them:
```tsx
<Button variant="ghost" size="icon" className="h-10 w-7 rounded-md shrink-0 px-0 text-muted-foreground hover:text-foreground" onClick={() => shiftDate(-1)} aria-label="Previous day">
  <ChevronLeft className="h-4 w-4" />
</Button>
…
<Button variant="ghost" size="icon" className="h-10 w-7 rounded-md shrink-0 px-0 text-muted-foreground hover:text-foreground" onClick={() => shiftDate(1)} aria-label="Next day">
  <ChevronRight className="h-4 w-4" />
</Button>
```
- `variant="ghost"` removes the yellow border entirely; the chevron sits on the card's neutral surface and only highlights on hover.
- `w-7` (28px) instead of `w-9` shrinks the container; `px-0` keeps the icon visually centered.
- Trim the date-column grid width from `230px` back to `200px` since the arrows are now narrower:
  `grid sm:grid-cols-[230px_1fr_auto]` → `grid sm:grid-cols-[200px_1fr_auto]`.

### Files touched
- `src/pages/AdvancedPage.tsx`

### Verification
- Player Matchup → Ajay Mitchell (off) + Aaron Gordon (def) → click `Open Matchup on NBAPlayDB` → opens `https://www.nbaplaydb.com/search?actionplayer=Ajay+Mitchell&defensivePlayers=Aaron+Gordon&offensivePlayers=Ajay+Mitchell` (full param string in the address bar).
- Tabs row: both `🏀 Player Matchup` and `🏀 By Game` are the same width, centered horizontally inside the NBA Play Search card, and visibly wider than before.
- By Game: prev/next arrows are borderless, narrower (28px), match the muted text color, and highlight on hover. Date input + arrows still fit on one line.

