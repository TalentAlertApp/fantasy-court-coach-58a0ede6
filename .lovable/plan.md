## Goal

Replace text/emoji flag rendering with actual country flag images, and show flag-only (no country name) in the Player Modal.

## Why it's broken

`NationalityFlag` builds a unicode flag from two regional-indicator code points. Chrome on Windows (and some other environments) doesn't ship flag glyphs, so the browser falls back to rendering the letters ("US", "BR", "GB"). That's why the user sees `US` chips instead of the US flag.

## Changes

### 1. `src/lib/nationality.ts`
- Keep the country→ISO-3166 alpha-2 map (already covers all 28 WNBA nationalities).
- Add `isoCode(name)` helper returning the lowercase 2-letter code (e.g. `"us"`).
- Drop `flagEmoji` (no longer used) or leave it as a fallback — not referenced after this change.

### 2. `src/components/NationalityFlag.tsx` (rewrite)
- Replace the emoji-in-a-circle with an `<img>` flag from `https://flagcdn.com/w40/{iso}.png` (retina via `srcSet` `w80 2x`).
- Render as a small round badge:
  ```
  <img
    src={`https://flagcdn.com/w40/${iso}.png`}
    srcSet={`https://flagcdn.com/w80/${iso}.png 2x`}
    alt={label}
    title={label}
    loading="lazy"
    className="inline-block rounded-full object-cover ring-1 ring-foreground/15 {SIZE}"
  />
  ```
- Sizes: `xs` 16×16, `sm` 20×20, `md` 24×24 (match current visual footprint).
- Keep the optional `showLabel` prop (used in `PlayerRow` for the NAT column → " United States" text next to the flag).
- If no ISO match → render nothing (current behavior preserved).

### 3. `src/components/PlayerModal.tsx` (line 216)
- Change `<NationalityFlag … showLabel … />` to `<NationalityFlag country={...} size="sm" />` so the modal shows the flag only, no "United States" text after it.

## Not changing
- `PlayerRow` (List view NAT column) keeps `showLabel` → "🇺🇸 United States".
- `TeamModal` roster keeps the small flag (no label).
- No backend / data / contracts changes; `nationality` field already plumbed end-to-end.
- No new dependency — flagcdn.com is a free public CDN serving PNG/SVG flag assets, used directly via `<img src>`.

## Verification
- Open PlayerModal for a US player → flag image only after "Iowa ·", no "United States" text.
- Open List view NAT column → round flag + country name renders as image, not "US" letters.
- Open Team Modal roster → small round flag next to each player name.
