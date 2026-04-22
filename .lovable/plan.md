

## Adjust for free-tier Supabase: handle leaked password protection finding

Since `SUPA_auth_leaked_password_protection` requires Supabase Pro, we'll close it out as an accepted limitation and strengthen what we control client-side instead.

### 1. Mark the finding as Ignored
Update `SUPA_auth_leaked_password_protection` in the security scanner with reason:
> "Requires Supabase Pro (HaveIBeenPwned integration). Project is on free tier. Compensating control: client-side minimum password length of 8 enforced on sign-up in `src/pages/AuthPage.tsx`."

### 2. Strengthen sign-up password rules in `src/pages/AuthPage.tsx`
Currently the password input only enforces `minLength={6}`. Tighten to reduce risk of weak/common passwords:
- Raise `minLength` from 6 → **8** on both inputs
- Add a lightweight client-side check in `handleSignUp` rejecting passwords that are:
  - shorter than 8 chars
  - all-numeric
  - equal to the email local-part
- Show a clear toast on rejection; keep `handleSignIn` unchanged (don't lock existing users out)
- Add a small helper text under the password field on sign-up: "At least 8 characters. Avoid common or reused passwords."

### 3. No database or edge function changes
RLS hardening from the previous migration stays in place. Nothing else to adjust.

### Files touched
- `src/pages/AuthPage.tsx` — password validation + helper text
- Security scanner — mark `SUPA_auth_leaked_password_protection` as Ignored

### Outcome
- Security panel: 0 outstanding findings (all four prior issues fixed; this one accepted with documented compensating control)
- New sign-ups must meet a stronger baseline; existing users unaffected
- If you ever upgrade to Supabase Pro, just toggle the Auth setting on — no code changes needed

