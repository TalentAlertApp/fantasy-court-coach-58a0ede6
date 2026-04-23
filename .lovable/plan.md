

## Roster row polish + Trade Report extra metrics (revised)

### 1. My Roster — bold/larger salary, watermark stays on the right (`src/components/transactions/RosterPane.tsx`)

Clarification: keep the team-logo **watermark** (don't replace it with an inline badge). The watermark sits on the **right edge of the row, right after the salary** — that's the "premium IN/OUT card" look the user wants on each roster row.

Changes inside `RosterRow`:
- Keep wrapper `relative overflow-hidden`.
- Keep the watermark `<img>` but anchor it to the **right edge, vertically centered**, sized so it crowns the salary:
  ```tsx
  {teamLogo && (
    <img
      src={teamLogo}
      alt=""
      aria-hidden
      className="pointer-events-none absolute -right-3 top-1/2 -translate-y-1/2 h-14 w-14 object-contain opacity-[0.20] rotate-12 select-none"
    />
  )}
  ```
  (Vertically centered so the salary sits inside the watermark cloud — exactly the "team-coloured right edge" effect.)
- Salary span: `text-[10px] font-mono text-muted-foreground` → **`text-sm font-bold tabular-nums text-foreground`** (bigger, bolder, full foreground color).
- Salary stays the rightmost element inside the `z-10` content wrapper. Add a tiny right padding (`pr-1`) so the bold salary doesn't crash into the watermark center.
- No inline crisp logo — only the watermark.

### 2. Trade Report — Roster Impact: 4 additional metrics (`src/components/transactions/TradeReport.tsx`)

Add 4 more `MetricRow`s after "Teams used":

| Metric | Source | Format |
|---|---|---|
| **Sum PTS5** | `last5.pts5` summed across roster | `n.toFixed(1)` |
| **Sum REB5** | `last5.reb5` summed | `n.toFixed(1)` |
| **Sum AST5** | `last5.ast5` summed | `n.toFixed(1)` |
| **Sum MPG5** | `last5.mpg5` summed | `n.toFixed(1)` |

Compute before/after exactly like the existing FP5/Stocks5 rows via a small helper:
```tsx
const sumLast5 = (rows: PlayerListItem[], key: "pts5"|"reb5"|"ast5"|"mpg5") =>
  rows.reduce((s, p) => s + ((p.last5 as any)?.[key] ?? 0), 0);
```

Total 9 metric rows — fits comfortably in the card; internal `overflow-y-auto` already in place.

### Files touched

- `src/components/transactions/RosterPane.tsx` — Reposition watermark to right-edge / vertically centered, bump salary to `text-sm font-bold tabular-nums text-foreground`.
- `src/components/transactions/TradeReport.tsx` — Add `sumLast5` helper + four before/after computations (PTS5, REB5, AST5, MPG5); render 4 new `<MetricRow>` entries inside Roster Impact after "Teams used".

### Out of scope

- Right-side players table (no changes).
- Trade Report player IN/OUT card watermark (kept as-is).
- AI Verdict card (no changes).

