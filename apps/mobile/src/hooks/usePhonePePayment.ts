import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/AuthProvider';
import { initiatePhonePePayment, checkPhonePePaymentStatus } from '../lib/phonepe';

interface InitiatePaymentInput {
  userPhone: string;
}

// Initiate PhonePe payment — the amount is decided server-side from
// app_settings, never trusted from the client.
export function useInitiatePhonePePayment() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userPhone }: InitiatePaymentInput) => {
      if (!session?.user.id) throw new Error('Not authenticated');
      return initiatePhonePePayment({ userPhone });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrationPayment'] });
    },
  });
}

// Poll payment status. The edge function re-checks with PhonePe and, on a
// terminal state, approves/rejects the payment server-side before replying.
export function useCheckPhonePeStatus(merchantOrderId: string | null) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['phonePeStatus', merchantOrderId],
    enabled: !!merchantOrderId && !!session?.user.id,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: (query) => (query.state.data === 'pending' ? 2000 : false),
    queryFn: async () => {
      if (!merchantOrderId) return null;
      return checkPhonePePaymentStatus(merchantOrderId);
    },
  });
}
