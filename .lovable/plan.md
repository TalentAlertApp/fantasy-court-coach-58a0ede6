# Premium redesign of the /leagues page

The /leagues page (`src/pages/LeaguesPage.tsx`) currently lags behind the rest of the app: in light theme several labels are near-invisible (bright pastel text on white), the meta rows are tiny and faint, there are no hover affordances, and the grid card watermark sits in the lower-right. This plan brings it up to the app's premium sports-editorial standard without changing any data/business logic.

## Root problems identified

1. **Light-theme unreadable labels** — `StatusPill`, chip pills, and "mine/teams" counters use dark-mode-only colors like `text-emerald-300`, `text-amber-300`, `text-violet-300`, `text-cyan-300`. These are pale on a white card and fail in light mode.
2. **Faint micro-typography** — meta rows are `text-[9px]/[10px]` `text-muted-foreground`, hard to scan.
3. **No hover feedback / no info on hover** — rows and cards only do a subtle background tint; nothing tells the user what an item is or what actions exist.
4. **Watermark placement** — grid card league logo is anchored bottom-right; user wants it top-right (same look, new corner).
5. **Flat, low-premium feel** — borders/shadows are minimal, no accent depth.

## Changes (all in `src/pages/LeaguesPage.tsx`)

### 1. Theme-safe status & chip colors
- Rewrite `StatusPill` to use dual-theme classes so it reads in BOTH modes, e.g. active → `text-emerald-700 dark:text-emerald-300` with matching bg/border; draft/open → amber-700/300; default → muted. Keep the same pill shape and uppercase tracking.
- Rewrite chip pills (Captain/Wildcard/All-Star) the same way: `text-amber-700 dark:text-amber-300`, `text-violet-700 dark:text-violet-300`, `text-cyan-700 dark:text-cyan-300`, each with a readable bg/border in light mode. Applies to both `LeagueCard` and `PublicLeagueCard`.

### 2. Stronger, more legible meta typography
- Bump meta rows from `text-[9px]/[10px]` to `text-[11px]` and the faint label captions to `text-foreground/70` (from muted) so "SCORING / DEADLINE / CHIPS" labels and the sport/teams/mine counters are clearly readable.
- Render the league sport as a small `LeagueLogoBadge` + label instead of a bare faint text chip, for consistency with the rest of the app.

### 3. Hover affordances + info on hover
- **List rows** (`LeagueListRow`, `PublicLeagueListRow`): add a clear hover state (`hover:bg-accent/10`, subtle left accent bar on hover, row lift via shadow), make the whole row keyboard/clickable to open, and reveal the action icons with full opacity on hover (dim slightly at rest). Add `title=`/`aria-label` tooltips describing each row (e.g. "Open <name> — <sport>, <n> teams, <status>") and each action.
- **Grid cards** (`LeagueCard`, `PublicLeagueCard`): add `hover:-translate-y-0.5`, accent ring + soft shadow on hover (`hover:shadow-[0_12px_40px_-12px_hsl(var(--accent)/0.35)]`), and surface a one-line summary tooltip on the card.

### 4. Move grid watermark to top-right
- In `LeagueCard` and `PublicLeagueCard`, move the watermark `<img>` from `-right-6 -bottom-6` to `-right-6 -top-6` (keep size `h-32`, opacity `0.12`, rotation, blur exactly as-is) so the logo sits in the top-right corner with the same look. The Commissioner / Main badge currently lives top-right — reposition that badge to the top-left so it no longer collides with the relocated logo.

### 5. Premium polish (theme tokens only)
- Cards: upgrade base to `rounded-2xl`, `border-border/70`, a subtle top-edge accent gradient line, and the hover elevation above.
- List container: keep the divided list but add row padding `py-3`, a refined hover, and a faint zebra via `bg-card`/`bg-card/60` is avoided in favor of clean dividers.
- Header & filter bar: tighten contrast of the "Active first" select and search affordances so they read in light mode (use `text-foreground` not muted on values).
- All colors via existing semantic tokens / dual-theme utility classes — no new CSS variables required.

## Out of scope
- No changes to data fetching, join/attach logic, routing, or the Discover edge function.
- No new color tokens in `index.css` (dual-theme Tailwind classes are sufficient).

## Technical notes
- Single file edited: `src/pages/LeaguesPage.tsx`.
- Reuse `LeagueLogoBadge` (already imported elsewhere) for the sport badge.
- Verify in both light and dark themes that StatusPill, chips, and meta text are legible after the change.
