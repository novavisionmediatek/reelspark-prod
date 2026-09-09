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
    detectSessionInUrl: false,
  },
});
