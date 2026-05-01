
# Plan — Photo fixes, Recap cleanup & Ballers.IQ AI insight layer

## 0) Player photos — natural proportion everywhere

**Root cause:** `AvatarImage` (radix) uses `aspect-square h-full w-full` with no `object-fit`. NBA headshots are wider than tall, so they get squished. In `PlayerRow.tsx` the `<img>` uses `object-cover` on a 10×10 square, which crops the head.

**Fix:** Treat headshots as portrait crops anchored to the top of the head.

- Update `src/components/ui/avatar.tsx` → `AvatarImage` default classes to `aspect-square h-full w-full object-cover object-top`.
- Update `src/components/PlayerRow.tsx` photo `<img>` → add `object-top` (keep `object-cover`) and a tiny scale so face shows: `object-cover object-top scale-110`.
- Apply the same `object-cover object-top` to:
  - `src/components/RosterListView.tsx` (list rows)
  - `src/components/transactions/RosterPane.tsx` (Avatar usage already inherits the fix)
  - `src/components/GameDetailModal.tsx` (Avatar usage inherits)
  - `src/components/TeamModal.tsx` roster table photos
  - `src/components/TransactionsTable.tsx` if it renders photos
- For larger circular avatars (≥ 40px) keep `object-top`; for small chips (≤ 28px) use `object-top scale-[1.15]` so the face isn't tiny.

Result: across `/`, `/transactions`, `/schedule`, team modal — players show natural head/shoulders, no squish.

## 1) `/schedule` Watch Recap — remove green monitor placeholder

In `src/components/ScheduleList.tsx` (lines ~88–116):
- Remove the green circle + `Tv2` icon block (lines 105–107) and the secondary subtitle (lines 110–112).
- Keep:
  - Two team badges (move them from background watermark to foreground at sensible size, e.g. `w-16 h-16`, full opacity, with `@` between them or just spaced).
  - The `WATCH RECAP` label as the main centered text below the badges.
- Keep hover state (border highlight) and click-to-expand behavior intact.

## 2) Ballers.IQ — branded AI insight layer

### 2a) Brand assets
Copy uploaded images into `public/brand/`:
- `ballers-iq-wordmark-light.png`, `ballers-iq-wordmark-dark.png`
- `ballers-iq-emblem-light.png`, `ballers-iq-emblem-dark.png`
- `ballers-iq-app-icon.png`
- `ballers-iq-badge.png`

### 2b) Insight service (deterministic v1, AI-ready)

**New file:** `src/lib/ballers-iq.ts`

```ts
export type BallersIQContext = "lineup" | "player" | "game_night" | "recap";
export type BallersIQAction = "START"|"BENCH"|"CAPTAIN"|"ADD"|"DROP"|"WATCH"|"HOLD"|null;
export type BallersIQRisk = "LOW"|"MEDIUM"|"HIGH"|null;
export type BallersIQInsightType =
  "CAPTAIN"|"LINEUP"|"PLAYER"|"GAME"|"RECAP"|"RISK"|"VALUE"|"FORM"|"MARKET";

export interface BallersIQInsight {
  type: BallersIQInsightType;
  title: string;
  headline: string;
  bullets: string[];
  playerIds: number[];
  confidence: number;   // 0..1
  action: BallersIQAction;
  riskLevel: BallersIQRisk;
}

export interface BallersIQResponse { summary: string; insights: BallersIQInsight[]; }

export function getBallersIQInsights(
  context: BallersIQContext,
  payload: { players?: any[]; roster?: any[]; schedule?: any[]; player?: any; recap?: any }
): BallersIQResponse;
```

Deterministic rules (no API call needed for v1):
- **lineup:** Captain Edge = roster starter with highest `fp_pg5`. Risk Radar = starters with `injury` flag or `delta_mpg < -3` or no upcoming game. Value Pick = bench player with best `value5`.
- **player:** action by `delta_fp` (>+3 START, <-3 BENCH/DROP, else HOLD/WATCH); risk from `injury`/minutes volatility.
- **game_night:** count active roster players in tonight's games; flag late tipoffs; flag starters with no game.
- **recap:** scan last gameweek's totals — best contributor, captain ROI, missed bench upside.

Always grounded in app data only. No fabricated injuries/news.

### 2c) Reusable UI components

All under `src/components/ballers-iq/`:

1. **`BallersIQBrand.tsx`** — props: `variant: "wordmark"|"emblem"|"appIcon"|"badge"`, `size: "sm"|"md"|"lg"`, `themeAware?: boolean`. Picks `-light` vs `-dark` from the active theme via `useTheme()` hook (already in repo) or `prefers-color-scheme` fallback. Heights: sm 16px, md 24px, lg 36px (wordmark); emblem square.
2. **`BallersIQCard.tsx`** — compact card: emblem (sm) + title + headline + bullets + optional confidence pill + optional action badge (color by action: START=emerald, BENCH=zinc, CAPTAIN=gold, RISK=red).
3. **`BallersIQPanel.tsx`** — section container: wordmark header + summary + slot for cards. Dark/light theme aware borders & background (`bg-card border-border` for light, `bg-card/60 backdrop-blur` for dark).
4. **`BallersIQTicker.tsx`** — horizontal scrolling/fading strip of one-liners (CSS marquee, pauses on hover).
5. **`BallersIQPlayerVerdict.tsx`** — large action label, headline, 2–3 bullets, risk + confidence chips.
6. **`BallersIQRecapBlock.tsx`** — narrative block: summary, "Best Call", "Missed Edge", "Next Move".

Style tokens: gold = `#c9a84c`/`text-amber-400`, navy = existing `bg-card`. No hard-coded backgrounds that fail in light mode.

### 2d) Integrations (no removals)

- **Lineup page (`src/pages/RosterPage.tsx` / `RosterCourtView`/`RosterSidebar`)**: add a `BallersIQPanel` titled "Ballers.IQ Lineup Advisor" with cards for Captain Edge, Risk Radar, Value Pick. Place in existing right rail (do not overlap court).
- **Player Modal (`src/components/PlayerModal.tsx`)**: add `BallersIQPlayerVerdict` near the top stats area (after header, before deep stats). Replaces nothing.
- **Schedule (`src/components/ScheduleList.tsx` / `SchedulePage`)**: add a slim `BallersIQTicker` strip above the day's games + a `BallersIQCard` ("Tonight's Edge") in the side panel.
- **Scoring/Recap (`src/pages/ScoringPage.tsx`)**: add a `BallersIQRecapBlock` above the detail table.
- **AI Coach button (`src/components/AICoachModal.tsx` trigger in nav/sidebar)**: keep functionality, but rename label to "Ballers.IQ" and swap the icon to `ballers-iq-app-icon.png`. Inside the modal, add a small `BallersIQBrand variant="wordmark"` header. Existing `ai-coach` edge function untouched.

### 2e) AI wiring (optional v1)

`getBallersIQInsights` first returns deterministic insights. A flag `BALLERS_IQ_USE_AI` (default `false`) can later switch to call the existing `ai-coach` edge function and reshape the JSON to the schema above — no edge-function changes required for v1.

## Acceptance

- Player headshots display with natural head/shoulders framing on `/`, `/transactions`, `/schedule` and team modal.
- Watch Recap card on `/schedule` shows only team badges + "WATCH RECAP" text; click still expands inline.
- New `Ballers.IQ` panel/cards/verdict/recap/ticker render in both light & dark themes using the right brand asset.
- AI Coach functionality preserved; relabeled to Ballers.IQ with new icon.
- No fabricated data — insights grounded in existing roster/players/schedule/scoring data.

## Files

**New:** `public/brand/*.png` (6 assets), `src/lib/ballers-iq.ts`, `src/components/ballers-iq/{BallersIQBrand,BallersIQCard,BallersIQPanel,BallersIQTicker,BallersIQPlayerVerdict,BallersIQRecapBlock}.tsx`

**Edited:** `src/components/ui/avatar.tsx`, `src/components/PlayerRow.tsx`, `src/components/RosterListView.tsx`, `src/components/TeamModal.tsx`, `src/components/TransactionsTable.tsx` (if applicable), `src/components/ScheduleList.tsx`, `src/pages/RosterPage.tsx`, `src/components/PlayerModal.tsx`, `src/pages/ScoringPage.tsx`, `src/components/AICoachModal.tsx` (+ its trigger in `src/components/layout/AppLayout.tsx`).
