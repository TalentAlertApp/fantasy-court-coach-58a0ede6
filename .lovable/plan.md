## 1. Ballers.IQ → Market Watch tab layout rebalance

File: `src/components/ballers-iq/MarketWatchStudio.tsx` (PRE-SUGGESTION state, lines ~452–534).

Today the hero is a 5/7 grid (Transfer Intelligence | Market Pulse), and Best Swap Available sits as a full-width strip below.

Change to a two-column hero that keeps all three cards aligned to the same vertical height:

```text
┌──────────────────────────┬──────────────────────────┐
│  TRANSFER INTELLIGENCE   │  MARKET PULSE (compact)  │
│  (Market Watch hero)     ├──────────────────────────┤
│  full height of column   │  BEST SWAP AVAILABLE     │
└──────────────────────────┴──────────────────────────┘
```

Implementation:
- Wrap the hero block in `grid md:grid-cols-12 gap-3 items-stretch`.
- Left column: existing Transfer Intelligence `GlassPanel` → `md:col-span-5`, add `h-full flex flex-col` so it stretches.
- Right column: new `md:col-span-7 flex flex-col gap-3`:
  - Top: existing Market Pulse panel, shrunk. Reduce padding to `p-4`, tighten the 6-stat grid to a single `grid-cols-6 gap-1.5` row with smaller `Stat` tone (no `md:` rewrap) so it occupies roughly 40% of the column height.
  - Bottom: move the entire Best Swap Available block (or the "No Clear Swap Edge Found" fallback) inside this column with `flex-1`. Internally rework its `md:grid-cols-12` into a denser layout that fits the narrower 7-col width: stack the header label on top and keep `Sell / Drop ↔ Buy / Add` row + FP5Δ / SalaryΔ chips at right, all inside one rounded card.
- Remove the standalone full-width Best Swap block that previously rendered below.
- Result: Transfer Intelligence (left) and the stacked Market Pulse + Best Swap (right) share the same outer height; the deterministic `BallersIQMarketWatch` card now moves up directly below, recovering the empty space.

No logic, scoring, or data changes — purely layout/markup/Tailwind.

## 2. Sidebar — add Next Lock + UX polish

File: `src/components/layout/AppLayout.tsx` (with small CSS tweaks in `src/index.css` if needed for the new card).

### 2a. New `SidebarNextLock` component
- Create `src/components/layout/SidebarNextLock.tsx`.
- Source data: reuse the same gameday deadline already used by `RosterPage` (`useCurrentGameday` + `useCountdown` against `currentGameday.deadline_utc`) so it always matches the header countdown. Pull `selectedTeamId` from `TeamContext` (same as RosterPage).
- Expanded state: a compact card with:
  - Tiny uppercase label `NEXT LOCK` (text-[10px] tracking-[0.22em] muted).
  - Mono countdown `HH:MM:SS` in amber, large (`text-xl font-mono`), turns red when `LOCKED`.
  - Sub-line `Gameweek {gw}.{day}`.
  - Lock icon on the right in an amber ring (matches uploaded reference).
  - Background: `bg-white/[0.03]` with inset border, rounded-lg, subtle amber border tint when <30 min.
- Collapsed state: only the lock icon, with the countdown shown in a tooltip on hover (reusing `NavTooltip`).
- Gracefully renders nothing if there's no upcoming deadline.

### 2b. Sidebar restructure
Goal: clear hierarchy, less wasted vertical space, premium feel; works in both expanded and collapsed modes.

New stacking order (top → bottom), each separated by a divider:
1. Brand row (Fantasy / Manager + How-to-Play + Feedback) — unchanged, but reduce `py-5` → `py-4`.
2. Primary nav (My Roster … Commissioner) — `flex-1` keeps it taking available space; reduce gap between items from `gap-1` to `gap-0.5` and shrink `nav-item` vertical padding by 1px to give the new card room without scroll.
3. Player Search section — unchanged structure, reduced top/bottom padding (`pt-1.5 pb-1.5`).
4. Your Team (TeamSwitcher) — unchanged structure, same tightened padding.
5. **NEW: Next Lock card** — `SidebarNextLock` rendered in its own padded section, directly above Account; in collapsed mode shows just the lock icon centered.
6. Account section — keep email + sign out; combine the Light/Dark + Hide buttons into a single tighter row.

### 2c. Spacing / polish details
- Reduce `sidebar-divider` margin so dividers don't dominate (`my-1.5` → e.g. `my-1`).
- Section labels (`sidebar-section-label`): keep style, but reduce `pt-2 pb-1` wrappers to `pt-1.5 pb-0.5`.
- Theme/Hide buttons: ensure both expanded and collapsed versions share identical icon size and hover treatment.
- Collapsed-mode order mirrors expanded: brand logo → nav icons → search icon → feedback icon → next-lock icon → sign-out → dark-toggle → expand chevron, all vertically centered with consistent 8px gaps.
- Verify no overflow at standard heights; the nav section already scrolls via `overflow-y-auto`, so the bottom block (search → team → next lock → account) stays pinned.

No changes to navigation routes, data hooks beyond importing the existing deadline hook, or business logic.

## Files touched
- `src/components/ballers-iq/MarketWatchStudio.tsx` (layout only)
- `src/components/layout/SidebarNextLock.tsx` (new)
- `src/components/layout/AppLayout.tsx` (insert card, tighten spacing)
- Possibly `src/index.css` for minor `.sidebar-divider` / `.sidebar-section-label` spacing tweaks
