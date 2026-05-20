## Goals
1. Make the Feedback modal look premium — the brand's face inside the app.
2. Actually deliver feedback to `alertadetalento@gmail.com` (mailto isn't reliable — many users don't have a configured mail client, so nothing arrives).
3. Remove the `route:` line from the confirmation preview.

---

## 1) Real email delivery (Resend edge function)

Create a new Supabase edge function `send-feedback` that posts to Resend.

- Requires secret `RESEND_API_KEY` (will prompt the user to add it).
- Sender: `Hoops Fantasy Feedback <onboarding@resend.dev>` (Resend's sandbox sender, works immediately with no domain verification, delivers to the team inbox). We can swap to a verified domain later.
- To: `alertadetalento@gmail.com`.
- Reply-To: the signed-in user's email (so replies go back to them).
- Subject: `Hoops Fantasy Manager Feedback — <route label>`.
- Body: HTML + plaintext with the three sections (Issues / Suggestions / Loved it), plus a small footer with route, user email, timestamp, league.
- Auth: invoke with the user's Supabase JWT; function reads `auth.uid()` + email server-side for trust.

Client flow in `FeedbackModal.tsx`:
1. On "Confirm & send" → call `supabase.functions.invoke("send-feedback", { body: {...} })`.
2. On success → success toast "Feedback sent — thank you", close modal.
3. On failure → fall back to `mailto:` and show a toast explaining the fallback opened the user's mail app.

No mailto by default anymore — it's only the fallback.

---

## 2) Premium redesign

Drop the boxy default `Dialog` look. New visual treatment, dark + light aware:

**Background**
- Full-bleed basketball court image as modal backdrop (use one of the existing court SVG/PNG assets in the repo — pick the cleanest one; if none fits, generate a subtle line-art court).
- Dark mode: court at ~8–12% opacity over a near-black gradient (`hsl(var(--background))` → `hsl(var(--card))`) with a top-down vignette so text stays readable.
- Light mode: court at ~10% opacity over a warm off-white gradient with a soft top vignette.
- A subtle radial accent glow in NBA yellow at top-right (very low opacity) to give it premium depth.

**Header**
- Left: stacked NBA + WNBA logos side-by-side (small, ~h-6), separated by a thin vertical divider.
- Center/left of header: title `SEND FEEDBACK` in `font-heading uppercase tracking-[0.22em]`, with a smaller eyebrow line `MVP TESTING · YOUR VOICE SHIPS THE NEXT BUILD` in muted accent.
- Right: close button (already provided by Dialog).
- Thin gold hairline divider beneath the header (`border-accent/30`).

**Body — compose stage**
- Three section cards stacked, each:
  - Header row: icon in a small rounded square with section-tinted background (red-tinted for Issues, yellow for Suggestions, emerald for Loved), label in heading font, and a tiny char count on the right.
  - `Textarea` inside the card (rows 3, resize-none, transparent background, no inner border — border lives on the card itself), focus ring in accent yellow.
  - Card has soft `bg-card/60 backdrop-blur` + `border-border/60`, rounded-xl, subtle inner shadow.
- Footer pill (not full button) showing email + copy icon, muted style.

**Body — confirm stage**
- A premium "letter preview" card: paper-like surface (light tint in dark mode), monospaced body, accent-yellow left border bar. **No `route:` line** — only the three sections.
- Short reassurance: "We'll email this to the team and reply from `alertadetalento@gmail.com`."

**Footer buttons**
- Compose: ghost `Cancel` + primary `Send` (yellow accent fill, black text, font-heading uppercase, slight glow shadow `shadow-[0_0_20px_hsl(var(--accent)/0.35)]`).
- Confirm: ghost `Back` + primary `Confirm & send` (same premium style, with `Send` icon, loading spinner while invoking).

**Misc polish**
- Modal width `max-w-xl`, rounded `2xl`, border `border-border/60`, large shadow.
- Smooth fade/scale on open (Dialog default is fine).
- All colors via semantic tokens; only accent yellow & section tints use raw HSL vars already defined.

---

## 3) Trim the confirmation preview

Remove the trailing `--- route: ... sent: ...` block from the **on-screen** confirmation view. Keep a minimal footer (`route`, `user`, `sent_at`) only in the actual email payload sent to the server — useful for triage but not shown to the user.

---

## Files

**New**
- `supabase/functions/send-feedback/index.ts` — Resend POST + envelope responses.
- `supabase/config.toml` — register function with `verify_jwt = true`.

**Edited**
- `src/components/FeedbackModal.tsx` — full visual redesign + real send via `supabase.functions.invoke`, mailto fallback, drop route line from preview.

**Secret**
- `RESEND_API_KEY` (prompt user via secrets tool before deploying the function).

## Out of scope
- Verified custom sending domain (can do later, sandbox sender is fine for MVP).
- Storing feedback in a DB table (email is enough for now; can add later if you want a backlog).
