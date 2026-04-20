

## Plan: Game card venue tweaks — move venue name to far-right and use official NBA CDN images

### 1. Replace all 30 venue image URLs with the official NBA CDN URLs
File: `src/lib/nba-venues.ts`

Swap every `image` value in `NBA_VENUES` for the corresponding URL from the uploaded `nba_venue_image_urls_v2.csv`. Arena `name` values stay unchanged. The new URLs are NBA-hosted (cdn.nba.com), 1536x576 landscape crops perfect for a horizontal game-card background.

Updated map:
```ts
ATL: { name: "State Farm Arena",          image: "https://cdn.nba.com/manage/2024/08/state-farm-arena.jpeg" },
BOS: { name: "TD Garden",                 image: "https://cdn.nba.com/manage/2024/08/td-garden-1536x576.jpg" },
BKN: { name: "Barclays Center",           image: "https://cdn.nba.com/manage/2024/08/barclays-center-1536x576.jpg" },
CHA: { name: "Spectrum Center",           image: "https://cdn.nba.com/manage/2024/08/spectrum-center-1536x576.jpg" },
CHI: { name: "United Center",             image: "https://cdn.nba.com/manage/2024/08/united-center-1536x576.jpg" },
CLE: { name: "Rocket Arena",              image: "https://cdn.nba.com/manage/2024/08/rocket-mortgage-fieldhouse-1536x576.jpg" },
DAL: { name: "American Airlines Center",  image: "https://cdn.nba.com/manage/2024/08/american-airlines-center-1536x576.jpg" },
DEN: { name: "Ball Arena",                image: "https://cdn.nba.com/manage/2024/08/ball-arena-1536x576.jpg" },
DET: { name: "Little Caesars Arena",      image: "https://cdn.nba.com/manage/2024/08/little-caesars-arena-1536x576.jpg" },
GSW: { name: "Chase Center",              image: "https://cdn.nba.com/manage/2024/08/chase-center-1536x576.jpg" },
HOU: { name: "Toyota Center",             image: "https://cdn.nba.com/manage/2024/08/toyota-center-1536x576.jpg" },
IND: { name: "Gainbridge Fieldhouse",     image: "https://cdn.nba.com/manage/2024/08/gainbridge-fieldhouse-1536x576.jpg" },
LAC: { name: "Intuit Dome",               image: "https://cdn.nba.com/manage/2024/08/intuit-dome-1536x576.jpg" },
LAL: { name: "Crypto.com Arena",          image: "https://cdn.nba.com/manage/2024/08/crypto-com-arena-1536x576.jpg" },
MEM: { name: "FedExForum",                image: "https://cdn.nba.com/manage/2024/08/fedexforum-1536x576.jpg" },
MIA: { name: "Kaseya Center",             image: "https://cdn.nba.com/manage/2024/08/kaseya-center-1536x576.jpg" },
MIL: { name: "Fiserv Forum",              image: "https://cdn.nba.com/manage/2024/08/fiserv-forum-1536x576.jpg" },
MIN: { name: "Target Center",             image: "https://cdn.nba.com/manage/2024/08/target-center-1536x576.jpg" },
NOP: { name: "Smoothie King Center",      image: "https://cdn.nba.com/manage/2024/08/smoothie-king-center-1536x576.jpg" },
NYK: { name: "Madison Square Garden",     image: "https://cdn.nba.com/manage/2024/08/madison-square-garden-1536x576.jpg" },
OKC: { name: "Paycom Center",             image: "https://cdn.nba.com/manage/2024/08/paycom-center-1536x576.jpg" },
ORL: { name: "Kia Center",                image: "https://cdn.nba.com/manage/2024/08/kia-center-1536x576.jpg" },
PHI: { name: "Wells Fargo Center",        image: "https://cdn.nba.com/manage/2024/08/wells-fargo-center-1536x576.jpg" },
PHX: { name: "Footprint Center",          image: "https://cdn.nba.com/manage/2024/08/footprint-center-1536x576.jpg" },
POR: { name: "Moda Center",               image: "https://cdn.nba.com/manage/2024/08/moda-center-1536x576.jpg" },
SAC: { name: "Golden 1 Center",           image: "https://cdn.nba.com/manage/2024/08/golden-1-center-1536x576.jpg" },
SAS: { name: "Frost Bank Center",         image: "https://cdn.nba.com/manage/2024/08/frost-bank-center-1536x576.jpg" },
TOR: { name: "Scotiabank Arena",          image: "https://cdn.nba.com/manage/2024/08/scotiabank-arena-1536x576.jpg" },
UTA: { name: "Delta Center",              image: "https://cdn.nba.com/manage/2024/08/delta-center-1536x576.jpg" },
WAS: { name: "Capital One Arena",         image: "https://cdn.nba.com/manage/2024/08/capital-one-arena-1536x576.jpg" },
```

Optional polish: bump background opacity slightly (`opacity-[0.10] dark:opacity-[0.18]`) since the new official photos are higher quality and look great as a subtle brand layer behind the row.

### 2. Move the venue name from the center column to the far right of the game card
File: `src/components/ScheduleList.tsx`

Currently the italic venue name renders inside the center "@/FINAL/tipoff" column. Move it to the right edge so it sits inline with the action icons, immediately before the Recap (Tv2) icon.

Steps:
- Remove the `{venue?.name && (<span … italic …>{venue.name}</span>)}` block from the center status column.
- In the right-side action-icons cluster (the `flex items-center gap-1` group that contains the Recap / external link icons), prepend a venue name span just before the Recap icon:
  ```tsx
  {venue?.name && (
    <span
      className="hidden sm:inline-block text-[10px] italic text-muted-foreground/80 truncate max-w-[140px] mr-1"
      title={venue.name}
    >
      {venue.name}
    </span>
  )}
  ```
- Keep the existing `relative z-10` stacking so the name stays above the arena background.
- On mobile (`<sm`), hide the venue name (`hidden sm:inline-block`) so the action icons don't get squeezed; the arena background image still communicates the venue visually.

### Files touched
- `src/lib/nba-venues.ts` — replace all 30 `image` URLs with the official NBA CDN URLs.
- `src/components/ScheduleList.tsx` — relocate the italic venue name from the center column to just left of the Recap icon on the far right.

### Verification
- Open `/schedule` and expand a few different game cards: each row's background now shows a crisp, official NBA arena photo (e.g. ATL → State Farm Arena, LAL → Crypto.com Arena, CLE → Rocket Mortgage FieldHouse).
- The home arena name appears in small italic text on the far right of every game card, immediately before the Recap (Tv2) icon, and is hidden on narrow mobile widths to preserve action-icon spacing.
- The center column once again shows only `@`, `FINAL`, or the tipoff time — clean and uncluttered.

