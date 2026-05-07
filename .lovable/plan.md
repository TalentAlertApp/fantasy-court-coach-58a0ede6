## Part 1 — Missing Recaps table (NBA + WNBA aware)

In `/commissioner` YouTube Recaps card, add a new **"Missing Recaps"** panel directly under the existing Populate / Re-scan buttons.

### What it shows
A scrollable table of every FINAL game in the **currently selected league** (NBA or WNBA — driven by `useLeague()`) where `youtube_recap_id IS NULL`:

```text
┌─ Missing Recaps · WNBA · 47 games ────── [Re-scan missing only] ─┐
│ Date           │ Matchup            │ Status │ Action            │
├────────────────┼────────────────────┼────────┼───────────────────┤
│ Tue, May 6     │ NYL @ LAS          │ FINAL  │ [Refresh]         │
│ Tue, May 6     │ SEA @ PHX          │ FINAL  │ [Refresh]         │
│ …                                                                │
└──────────────────────────────────────────────────────────────────┘
```

- Columns: **Date** (Europe/Lisbon), **Matchup** (away tricode @ home tricode + small badges), **Status** (always FINAL — kept for clarity), **Action** (per-row "Refresh" button = single-game lookup, ~100 quota units).
- Header chip shows league + total missing count.
- Top-right action: **"Re-scan missing only"** — loops the missing rows in batches of 100, calling `youtube-recap-lookup?ids=<csv>&limit=100` (new param) until done or quota hits. Reuses the existing `recapProgress` indicator.

### Wiring
- Data source: direct Supabase query `from("schedule_games").select("game_id, game_date, home_team, away_team, status, youtube_recap_id, league").eq("league", currentLeague).eq("status","FINAL").is("youtube_recap_id", null).order("game_date",{ascending:false}).limit(500)`. Refetched after every Populate / Re-scan / Refresh action.
- New `youtube-recap-lookup` edge-function param: `ids=GAME_ID_1,GAME_ID_2,…` (max 100 per call) — when present, restrict the candidate set to those game_ids only (still honors `replace=1` if passed). Existing `game_id=` single-game param stays.
- "Refresh" per row hits `youtube-recap-lookup?game_id=<id>&replace=1` and toasts the result.

### Files
- `src/pages/CommissionerPage.tsx` — add `<MissingRecapsPanel/>` block + state + Supabase fetch.
- `src/components/commissioner/MissingRecapsPanel.tsx` (new) — table UI, league-aware, badge rendering via `useLeagueTeams()`.
- `supabase/functions/youtube-recap-lookup/index.ts` — accept `ids=` CSV param.

---

## Part 2 — AI Coach personalised draft modal: premium polish

Rework `src/components/ai-coach/StylePreferencesPanel.tsx` end-to-end.

### a) Team chips → Real team badges

Replace the rounded outline chips with the actual team logos via `useLeagueTeams().teams[*].logo` rendered as a borderless `<img>` (no chip container, no background). Layout: a flex-wrap row.

```text
States:
- default: 36×36, opacity 70%, no ring
- hover:   scales to 1.15, opacity 100%, soft accent glow ("surge")
- selected: scales to 1.30, opacity 100%, accent ring + drop-shadow,
            persistent glow
```

Selecting still caps at 3; counter "(2/3)" stays. Tooltip on hover shows full team name.

### b) Captain row gets photo + team badge

The live-preview "CAPTAIN" stat (currently just last-name text) becomes:

```text
┌─ CAPTAIN ─────────────────────────────────────────┐
│  [ photo ]   Dwight Howard   [LAL badge]          │
└───────────────────────────────────────────────────┘
```

- Photo: 44×44 rounded circle, uses `captain.core.photo`, no border container, soft drop-shadow, hover scale 1.1.
- Name: full first+last in heading font.
- Team badge after name: 24×24 logo from `useLeagueTeams()`, hover scale 1.15 ("surge"), no container.
- If no captain yet, show a subtle "Awaiting picks…" placeholder.

The other two preview stats (Salary Used, Roster Legal) stay; the whole strip becomes a 3-column grid with the captain block spanning 2 columns on desktop.

### c) Context-sensitive icons on each section header

Add lucide icons next to the 5 section labels:

| Section | Icon |
|---|---|
| SALARY ARCHETYPE | `DollarSign` |
| EXPERIENCE | `GraduationCap` |
| SIZE | `Ruler` |
| RISK APPETITE | `Flame` |
| FAVOURITE TEAMS | `Heart` |

Icons render at 14px in `text-accent` next to the existing uppercase tracked label.

### d) Premium layout polish

- Wrap the panel in a single `rounded-2xl border border-accent/20 bg-gradient-to-b from-card to-card/60 p-5 shadow-[0_30px_80px_-40px_hsl(var(--accent)/0.4)]` shell.
- Two-column grid on `md+`: left column = Archetype + Sliders; right column = Favourite teams + sticky live-preview card. Single column on mobile.
- Each section gets a thin divider above it (`border-t border-border/40 pt-4`) except the first.
- Archetype cards: gain subtle hover lift (`hover:-translate-y-0.5 transition-transform`) and selected state already has accent glow.
- Sliders: keep shadcn slider but increase track height via wrapper class + add tick marks at -1, 0, +1.
- Submit button: full-width, `bg-accent text-accent-foreground`, larger padding, `Wand2` icon stays.
- Live-preview pill bar: sticky on the right column at `md+`, becomes a solid accent-tinted card with the captain block above the salary/roster row.
- Headings/labels: use `font-heading` consistently, slightly larger tracking.
- Add a one-line subtitle under "Tell the coach your style": *"Five quick choices. We'll build a legal lineup that matches your vibe."*

### Files
- `src/components/ai-coach/StylePreferencesPanel.tsx` — full rewrite with sections above.
- `src/lib/personalised-draft.ts` — no logic changes (preview already returns captain + salary + legal).
- (No changes to `AICoachModal.tsx` shell — it already mounts the panel.)

---

### Out of scope
- Quota increase request to Google (manual GCP step).
- Persisting personalised draft preferences across sessions.
- Bulk "delete all empty recaps" — out of scope, the table makes the gap visible enough.
