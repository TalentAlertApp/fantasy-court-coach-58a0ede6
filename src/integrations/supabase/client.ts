import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Credentials come from Vite environment variables so the app can be pointed
// at different Supabase projects without code changes.
//
// Required vars (see project Settings -> Vars):
//   VITE_SUPABASE_URL       e.g. https://<ref>.supabase.co
//   VITE_SUPABASE_ANON_KEY  the publishable / anon key (safe for the browser)
//
// Anything server-side that needs admin access should read SUPABASE_SERVICE_ROLE_KEY
// (no VITE_ prefix) from process.env in scripts or edge functions — never from here.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  throw new Error(
    "Missing Supabase configuration. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment."
  );
}

// Guard rail: if a secret key is accidentally placed in a VITE_ var, Vite will
// inline it into the browser bundle. Fail loudly in dev so this never ships.
if (anonKey.startsWith("sb_secret_")) {
  throw new Error(
    "VITE_SUPABASE_ANON_KEY appears to be a secret key (sb_secret_*). " +
      "This would leak server credentials to the browser. Replace it with the publishable key."
  );
}

export const SUPABASE_URL = url;
export const SUPABASE_PUBLISHABLE_KEY = anonKey;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
