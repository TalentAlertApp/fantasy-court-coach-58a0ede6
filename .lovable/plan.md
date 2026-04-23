

## Premium sidebar refresh — match the TradeReport aesthetic

The current sidebar is functional but flat: solid navy fill, plain padded rows, a left border-stripe for the active item, a small NBA logo + "FANTASY" wordmark, and three identical pill buttons at the bottom. The TradeReport feels premium because it layers gradients, accent glows, subtle ring/border treatments, watermark logos, and uppercase tracking. We'll bring those same techniques to the sidebar.

### What changes (visually)

**Brand block (top)**
- Bigger NBA logo (h-9), tighter spacing.
- "FANTASY" wordmark on top, small "MANAGER" eyebrow underneath in muted accent yellow with extra letter-spacing — gives a sports-editorial masthead feel.
- Bottom border becomes a hairline gradient (transparent → border → transparent) instead of a flat line.
- Subtle court-pattern watermark (oversized NBA logo at low opacity, rotated, escaping the corner) behind the brand block — same recipe as TradeReport's player cards.

**Active nav item — the headline upgrade**
- Replace the flat `bg-sidebar-accent` + 3px left border with a layered treatment:
  - Background: gradient from `hsl(var(--accent)/0.18)` on the left to transparent on the right.
  - Left edge: 3px solid accent yellow bar with a soft 8px outer glow (`shadow-[0_0_12px_-2px_hsl(var(--accent)/0.6)]`).
  - Subtle inner ring `ring-1 ring-accent/20`.
  - Icon switches from yellow-always to: muted when inactive, accent-glow when active (`drop-shadow-[0_0_6px_hsl(var(--accent)/0.5)]`).
  - Label text gains `text-foreground` weight + tighter `tracking-[0.18em]`.
- Inactive items: lower opacity icon, hover lifts opacity + a tiny `translate-x-0.5` slide for a tactile feel.
- Add `transition-all duration-200` + `relative overflow-hidden` so we can slot a hover shimmer (same `after:` shimmer as the TRADE button, but dimmer — `via-white/5`).

**Sidebar background**
- Layer 2 gradients for depth: existing vertical navy gradient + a faint radial accent glow in the top-left corner (`radial-gradient(circle at top left, hsl(var(--accent)/0.08), transparent 40%)`).
- Right edge: replace flat `border-right` with a vertical gradient line (transparent → border → transparent) using a `::after` pseudo on `.sidebar`.

**Section dividers**
- Replace solid `border-t` / `border-b` with hairline gradient dividers (same recipe — fades at both ends).
- Add small uppercase section labels above the Team Switcher ("YOUR TEAM") and above the bottom controls ("ACCOUNT") in `text-[9px] tracking-[0.3em] text-foreground/30` — magazine-style section breaks.

**Bottom controls**
- Email row: wrap in a subtle pill background (`bg-white/[0.03] rounded-lg px-2 py-1.5`) with the email and the LogOut icon side-by-side — feels like a status card, not floating buttons.
- Theme toggle + Collapse: keep but restyle. Remove the bordered "theme-toggle" pill style; switch to ghost icon-buttons that grow a soft glow on hover. Group them on a single row when expanded (icon + tiny label), stack vertically when collapsed.

**Collapsed mode polish**
- Active item shows the glowing left bar + icon-only, centered, with a subtle accent ring around the icon.
- Tooltips on hover (already wired via `title=`) — no change needed.

### Implementation details

**File: `src/index.css`** (rewrite the sidebar/nav-item/theme-toggle blocks)
- `.sidebar`: add `position: relative`, layer the radial accent glow as a `background-image` on top of the existing gradient, swap `border-right` for an `::after` gradient line.
- `.sidebar-divider`: new utility for hairline gradient dividers.
- `.nav-item`: change to `relative overflow-hidden`, drop the flat `border-l-[3px]`. Hover gets `translate-x-0.5` and a faint `bg-white/[0.04]`.
- `.nav-item.active`: gradient background from accent/18 → transparent; pseudo-element `::before` for the glowing 3px left bar with `box-shadow`; `ring-1 ring-accent/15` inset.
- `.nav-item-icon` (new): handles muted vs. active glow states.
- Remove `.theme-toggle` rectangular border styling; rebuild as ghost icon-button (`rounded-lg`, transparent bg, `hover:bg-white/8`).

**File: `src/components/layout/AppLayout.tsx`**
- Brand block: add `relative overflow-hidden`, drop in a watermark `<img src={nbaLogo}>` with the same recipe used in `TradeReport.PlayerCard` (`absolute -top-6 -right-6 h-32 w-32 opacity-[0.08] rotate-12 pointer-events-none`). Add the "MANAGER" eyebrow under "FANTASY".
- Nav items: wrap icon in a `<span className="nav-item-icon">` so CSS can style icon glow per state. Drop the always-yellow icon color (let `.active` state drive it).
- Insert section labels ("YOUR TEAM", "ACCOUNT") and replace flat dividers with the new `.sidebar-divider` class.
- Bottom controls: regroup email + LogOut into a single rounded card; theme + collapse become ghost icon-buttons in a 2-up row (or stacked when collapsed).
- No changes to nav structure, routes, props, or interactivity.

**File: `src/components/NavLink.tsx`** — no changes.

### Out of scope

- Changing route order or adding/removing menu items.
- Touching the TeamSwitcher component itself (only its surrounding label).
- Mobile / off-canvas drawer behavior (current layout is desktop sidebar only).
- Color palette overhaul — we reuse existing `--accent`, `--sidebar-*`, and `--nba-yellow` tokens; nothing new added.

