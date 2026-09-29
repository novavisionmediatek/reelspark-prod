import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthProvider';
import type { RegistrationPayment } from '../types/database';

// The current user's most recent registration payment attempt. While it's still
// initiated (PhonePe checkout in progress) we poll so an approval shows up
// without a manual reload.
export function useRegistrationPayment() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ['registrationPayment', userId],
    enabled: !!userId,
    refetchInterval: (query) => {
      const status = (query.state.data as RegistrationPayment | null)?.status;
      return status === 'initiated' ? 5000 : false;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from('registration_payments')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as RegistrationPayment | null) ?? null;
    },
  });
}
