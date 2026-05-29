## Plan

1. Add the 4 HF logos as first-class app assets
- Copy HF1, HF2, HF3, HF4 into the repo as reusable branded assets.
- Create one small branding helper so the app can request the right HF logo by context instead of hardcoding files everywhere.
- Encode your league mapping rule there:
  - WNBA -> HF1
  - NBA -> HF2
  - EuroLeague -> HF4
  - HF3 reserved for future/manual uses

2. Rename visible brand text to HoopsFantasy in the requested screens
- Replace the current standalone `Fantasy` label with `HoopsFantasy` in these exact places:
  - left sidebar top brand
  - onboarding `PICK YOUR TEAM` top-left brand
  - login screen title under the 3 league logos
  - onboarding `DRAFT YOUR SQUAD` top-left brand
  - Daily Court Show branding text (both occurrences)
  - Ballers.IQ modal header secondary brand line
- Update the app name wording from `Hoops Fantasy Manager` to `HoopsFantasy Manager` in document metadata.

3. Add the requested watermark/logo treatments
- `Create Team -> Manual` / draft court:
  - keep the existing league watermark behavior but restyle it to match the stronger premium watermark treatment you asked for: top-right, bigger, cleaner, hover surge.
- `Team of the Week` header:
  - replace the current trophy icon with the league-matched HF logo.
- Keep existing hover/surge language consistent with the TOTW / premium-card patterns already used in the app.

4. Update Ballers.IQ and Court Show branding presentation
- In Ballers.IQ modal header, keep `Ballers.IQ` as product naming, but replace the old `Fantasy Broadcast Intelligence` wording with a HoopsFantasy-branded equivalent so the parent app brand is now consistent.
- In Daily Court Show, update both the top bar title context and the in-slide title copy to use the new HoopsFantasy naming while preserving the existing layout and motion.

5. Replace favicon/bookmark branding with the new HF system
- Update `index.html` metadata strings to `HoopsFantasy Manager`.
- Replace the current favicon with an HF-logo favicon system.
- Because you chose `per page load`, implement a lightweight client-side selection that picks one HF logo randomly on each load and applies it as the favicon for that session/load.
- Keep the selection limited to the provided HF set and make sure it does not interfere with the app runtime.

## Technical details
- Likely files touched:
  - `index.html`
  - `src/components/layout/AppLayout.tsx`
  - `src/pages/AuthPage.tsx`
  - `src/pages/TeamPickerPage.tsx`
  - `src/components/onboarding/OnboardingHero.tsx`
  - `src/components/onboarding/DraftPicker.tsx`
  - `src/components/TeamOfTheWeekModal.tsx`
  - `src/components/court-show/CourtShowModal.tsx`
  - `src/components/court-show/CourtShowSlide.tsx`
  - `src/components/AICoachModal.tsx`
  - one new shared branding utility module for HF asset selection
  - new asset files for HF1-HF4
- I will keep scope strictly to the requested branding/logo changes and avoid unrelated copy changes elsewhere in the app.