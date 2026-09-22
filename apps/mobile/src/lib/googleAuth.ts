import { supabase } from './supabase';

// Kicks off Supabase's OAuth redirect flow: the browser navigates to Google's
// consent screen and comes back to this same origin with the session already
// established (see supabase.ts's detectSessionInUrl). There's no follow-up
// step to call on return — AuthProvider's onAuthStateChange picks it up.
export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}
