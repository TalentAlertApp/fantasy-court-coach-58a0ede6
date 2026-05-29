## Goal

Two independent fixes:
1. Make the "3 league logos + HOOPSFANTASY" bundle render **identically** (order, size, spacing, position) on every onboarding page.
2. Remove the accidental horizontal scrollbar that appears in the left sidebar directly above the "Search player…" input — without touching dividers or sidebar design.

---

## Part 1 — Consistent brand bundle

### What's inconsistent today

The bundle is hand-coded separately in three files and they differ:

| File | Logo order | Dividers | Logo size | Brand text |
|------|-----------|----------|-----------|------------|
| `OnboardingHero.tsx` | NBA, WNBA, EuroLeague | yes (`w-px` lines) | `h-9` | `text-xs` / opacity 70 |
| `WelcomeBackHero.tsx` | WNBA, NBA, EuroLeague | none | `h-9` | `text-xs` / opacity 70 |
| `TeamPickerPage.tsx` | WNBA, NBA, EuroLeague | none | `h-8` | `text-[10px]` / opacity 60 |

Placement also differs: the two hero files put it inside a `<header class="px-8 py-4">`; `TeamPickerPage` uses `absolute top-6 left-6`.

### Fix

Create one shared presentational component, e.g. `src/components/onboarding/BrandMark.tsx`, that renders the canonical bundle:

```text
[WNBA] [NBA] [EuroLeague]  HOOPSFANTASY
```

- Order: WNBA, NBA, EuroLeague, then the `HOOPSFANTASY_NAME` text.
- Logos: `h-9 w-auto object-contain` (one size for all three).
- No divider lines.
- Brand text: `text-xs font-heading uppercase tracking-[0.3em] text-foreground/70`.
- Wrapper: `flex items-center gap-3`.

Then use `<BrandMark />` in all three files, replacing the inline markup:
- `OnboardingHero.tsx` — drop the NBA/divider/WNBA/divider/EuroLeague block and dividers.
- `WelcomeBackHero.tsx` — replace its inline bundle.
- `TeamPickerPage.tsx` — replace its inline bundle.

To make **position** identical too, align the placement. Keep each page's existing top-left anchor but use the same offset: the two heroes already sit in a `px-8 py-4` header (≈32px/16px); set `TeamPickerPage`'s wrapper to match that same inset so the bundle lands in the exact same spot visually across pages. (Single source for the inner content guarantees size/spacing; matching the inset guarantees position.)

---

## Part 2 — Remove stray horizontal scrollbar above Player Search

The sidebar nav uses `overflow-y-auto` with no horizontal control. Combined with `.nav-item` `margin-right: 8px` + hover `translateX(2px)`, content can exceed width and trigger the global 4px webkit horizontal scrollbar (which also turns accent on hover), appearing right above the Player Search box.

### Fix

1. In `src/components/layout/AppLayout.tsx`, change the nav class from `overflow-y-auto` to `overflow-y-auto overflow-x-hidden`.
2. In `src/index.css`, add a defensive rule: `.sidebar nav { overflow-x: hidden; }`.

Constraints respected:
- No `.sidebar-divider` elements removed.
- Player Search component untouched.
- Vertical scrolling preserved.
- Verify both expanded and collapsed sidebar states.

---

## Verification

- Compare the three onboarding pages side by side: bundle order, logo size, gaps, and top-left position match exactly.
- Confirm no horizontal bar/accent line appears above Player Search, including on hover, in both expanded and collapsed sidebar; vertical scroll still works.
