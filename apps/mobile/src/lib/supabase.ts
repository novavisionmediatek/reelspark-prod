import { createClient } from '@supabase/supabase-js';

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fall back to a syntactically valid placeholder so createClient() never throws
// and crashes the whole app before a real Supabase project exists yet (Phase 1).
// Auth/data calls will simply fail against this placeholder until real values are set.
const supabaseUrl = envUrl || 'https://placeholder.supabase.co';
const supabaseAnonKey = envAnonKey || 'placeholder-anon-key';

if (!envUrl || !envAnonKey) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
      'Copy .env.example to .env and fill in your Supabase project values. ' +
      'Auth and data screens will not work until you do.'
  );
}

// In the browser, supabase-js persists the session in localStorage by default.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    // Needed for Google OAuth: after the redirect back from Google the URL
    // carries a `?code=...` param that supabase-js must read to finish the
    // sign-in. It only looks for its own `code`/`access_token`/`error` params,
    // so this doesn't clash with this app's own `?v=`/`?ref=` link handling
    // (lib/sharedVideo.ts, lib/referral.ts), which run separately.
    detectSessionInUrl: true,
  },
});
