## 1) Free-form feedback modal (3 sections + Send + confirmation)

**File:** `src/components/FeedbackModal.tsx` (rewrite)

Replace the current "copy email + open mail app" layout with a real composer:

- Title + one-sentence intro stay (shortened to free vertical space).
- Three compact `Textarea`s stacked, each with its own small label:
  1. **Issues / Errors**
  2. **Suggestions**
  3. **Loved it**
- Each textarea sized so all three + header + footer fit a 1025px viewport with no scroll: `rows={3}`, `resize-none`, `text-sm`, `leading-snug`. Modal `max-w-lg`, body uses `space-y-3`.
- Footer: **Cancel** (outline) + **Send** (primary, disabled when all three are empty/whitespace).
- Send flow (mailto, per your choice):
  1. Open a small inline **confirmation step** inside the same `Dialog` ("Send this feedback to alertadetalento@gmail.com?") with **Back** and **Confirm & send**.
  2. On Confirm: build a single email body assembling only the non-empty sections under headers like `=== ISSUES / ERRORS ===`, plus the existing route/timestamp footer. Subject stays `Hoops Fantasy Manager Feedback — <route>`.
  3. Trigger `window.location.href = mailto:` (mail client opens), close modal, toast "Opening your email app…".
- Keep the small "Reach us at alertadetalento@gmail.com" line with copy-to-clipboard as a quiet fallback under the textareas (one line, not the prominent pill).

**No other files touched** for part 1. `AppLayout.tsx` already opens this modal.

---

## 2) Stable cap math + Value (L5) rounding to 1 decimal

### 2a) Shared rounding helper

**New file:** `src/lib/money.ts`
```ts
export const round1 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 10) / 10;
export const sum1 = (xs: Array<number | null | undefined>) =>
  round1(xs.reduce((s, v) => s + (Number(v) || 0), 0));
```

**New file:** `supabase/functions/_shared/money.ts` (mirror, so server + client agree).

### 2b) Server — `supabase/functions/roster-save/index.ts` and `roster-current/index.ts`

Apply `round1` to every cap-bearing value before returning JSON:
- `bank_remaining`, `locked_total`, `market_total`
- The `lockedBefore`, `freedMarket`, `costMarket`, `available`, and the diff (`costMarket - available`) used in the `OVER_BUDGET` check — use `round1` on both sides and compare with `> 0` instead of the current `+ 1e-6` epsilon trick. This eliminates the `99.9999999 vs 100` rejections.
- Same treatment in `transactions-simulate/index.ts` and `transactions-commit/index.ts` cap math so the simulate→commit→roster-current chain reports identical numbers.

### 2c) Client — consume the rounded server values as-is

- `src/pages/RosterPage.tsx`, `src/components/RosterSidebar.tsx`, `src/components/KpiTiles.tsx`, `src/components/BottomActionBar.tsx`, `src/components/SwapConfirmModal.tsx`, `src/components/transactions/TradeWorkbench.tsx`, `src/hooks/useTradeValidation.ts`: any place that currently does arithmetic on `bank_remaining`/`locked_total` (e.g. predicting the post-trade bank) routes through `round1` from `src/lib/money.ts`. Display uses `toFixed(1)` on already-rounded values.
- `src/lib/format-salary.ts`: leave `formatSalary` as-is (already 1 decimal-friendly), but add a `formatBank(n)` that returns `$${round1(n).toFixed(1)}M` for consistency.

### 2d) "Value 5" → N.D (1 decimal) everywhere it's rendered

Replace 2-decimal renders with 1-decimal:

| File | Change |
|---|---|
| `src/components/PlayerRow.tsx:184` | `formatStat(computed?.value5, 2, preseason)` → `formatStat(computed?.value5, 1, preseason)` |
| `src/components/PlayerModal.tsx:346` | `data.player.computed.value5.toFixed(2)` → `.toFixed(1)` |
| `src/components/PlayerCard.tsx` (V5 pill near line 302) | confirm pill uses `.toFixed(1)`; fix if 2 |
| `src/components/transactions/TradeReport.tsx:67` | already `toFixed(1)` — no change |
| `src/components/ballers-iq/BallersIQMarketWatch.tsx:158` | already `toFixed(1)` — no change |
| `src/components/ChartsPanel.tsx` tooltip/axis | round V5 tick formatter to 1 decimal |
| `src/components/AICoachModal.tsx`, `src/components/court-show/CourtShowSlide.tsx`, `src/components/advanced/TrendingTab.tsx`, `src/components/onboarding/DraftPicker.tsx`, `src/components/onboarding/PlayerMarquee.tsx` | grep-and-normalize any `value5.*toFixed(2)` / `formatStat(..., 2,` for value5 to 1 decimal |

Sort/filter logic (`usePlayersQuery`, `players-list`, `ai-coach`) keeps full precision — only the **display** is forced to 1 decimal.

### 2e) Verification

- Run `bunx vitest run` (existing tests).
- Manual: do a swap whose post-trade total lands at exactly the cap; bank should read `$0.0M` cleanly with no `OVER_BUDGET` from float noise.
- Manual: hover the V5 column / open PlayerModal — every value shows N.D, never N.CC.

---

## Out of scope
- No new backend mailer (mailto stays the transport).
- No changes to scoring math, FP5 logic, or Ballers.IQ scoring weights.
- No DB migration — cap rounding is presentation/contract layer only.