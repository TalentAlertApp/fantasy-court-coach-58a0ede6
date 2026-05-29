## Goal

Three focused, presentation-only fixes across the sidebar and onboarding flow.

---

### 1. Sidebar — premium separator between nav and Player Search

In `src/components/layout/AppLayout.tsx`, the COMMISSIONER nav item (last item) currently sits directly above the Player Search box with no separator. Add a soft, muted, premium divider between them.

- Reuse the existing `.sidebar-divider` token but give it a more premium feel for this specific spot by wrapping it with vertical breathing room (e.g. a small `my`/`py` gap) so it reads as an intentional section break rather than a hard line.
- Place it directly before the Player Search block (`{!collapsed ? ... : ...}`), so it shows in both expanded and collapsed states.
- Keep all other dividers, spacing, hover/surge effects untouched.

Implementation detail: insert a divider element (`<div className="sidebar-divider" />`) right after the `</nav>` close and before the Player Search conditional. To make it feel premium and "soft", wrap it in a thin padded container (e.g. `px-3` and a touch of vertical margin) rather than a flush line.

---

### 2. NAME YOUR FRANCHISE — use the shared BrandMark

`src/components/onboarding/NameStep.tsx` still renders an **inline** brand bundle (lines 40–49) that differs from the other onboarding pages:
- Wrong logo order (NBA → WNBA → EuroLeague instead of WNBA → NBA → EuroLeague).
- Extra `h-6 w-px` vertical separators between logos (the "separators in excess" the user sees).
- First logo missing `object-contain`.

Fix:
- Replace that inline block with `<BrandMark className="absolute top-4 left-8 z-10" />` (same usage as `TeamPickerPage`).
- Add the `BrandMark` import.
- Remove the now-unused imports: `nbaLogo`, `wnbaLogo`, `euroleagueLogo`, and `HOOPSFANTASY_NAME`.

This makes all four onboarding surfaces share one identical brand bundle.

---

### 3. DRAFT (Step 3 of 3) — match the CHOOSE YOUR LEAGUE watermark

`ChooseLeagueStep.tsx` renders the league watermark as:
```
absolute top-0 right-0 h-[28rem] w-[28rem] object-contain opacity-[0.06]
blur-[1px] rotate-6 -translate-y-12 translate-x-12 select-none z-0
```
`DraftPicker.tsx` (lines 188–206) uses a different watermark: smaller (`h-64 w-64`), brighter (`opacity-[0.18]`), with a radial glow circle and a hover scale/opacity effect.

Fix:
- Replace the DraftPicker watermark block with the exact same single `<img>` markup/classes used in `ChooseLeagueStep` (same size, opacity, blur, rotation, translate, position).
- Drop the radial-glow `<div>` and the hover `group` scaling so the size/effect/position match exactly.
- Keep using `watermarkSrc` (already `getLeagueLogo(leagueCode)`) as the source.

---

### Technical notes
- All changes are in `AppLayout.tsx`, `NameStep.tsx`, and `DraftPicker.tsx`. No CSS token changes are strictly required; the existing `.sidebar-divider` token is reused for fix 1.
- No logic, data, or routing changes — purely presentational.