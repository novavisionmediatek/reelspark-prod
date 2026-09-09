import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthProvider';
import type { ReferralEarning, ReferralWithdrawal } from '../types/database';

export type WalletEntry =
  | { kind: 'earning'; id: string; amount_inr: number; created_at: string }
  | {
      kind: 'withdrawal';
      id: string;
      amount_inr: number;
      created_at: string;
      status: ReferralWithdrawal['status'];
      upi_id: string;
    };

// The current user's referral wallet: the bonus ledger (credits), the
// withdrawals (debits), and a mutation to cash out. Withdrawals are
// auto-approved server-side, so a successful call debits the balance
// immediately.
export function useReferralWallet() {
  const { session, refreshProfile } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();

  const earnings = useQuery({
    queryKey: ['referralEarnings', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referral_earnings')
        .select('id, amount_inr, created_at')
        .eq('referrer_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Pick<ReferralEarning, 'id' | 'amount_inr' | 'created_at'>[];
    },
  });

  const withdrawals = useQuery({
    queryKey: ['referralWithdrawals', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referral_withdrawals')
        .select('id, amount_inr, created_at, status, upi_id')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Pick<
        ReferralWithdrawal,
        'id' | 'amount_inr' | 'created_at' | 'status' | 'upi_id'
      >[];
    },
  });

  const withdraw = useMutation({
    mutationFn: async ({ amountInr, upiId }: { amountInr: number; upiId: string }) => {
      const { data, error } = await supabase.rpc('request_referral_withdrawal', {
        p_amount_inr: amountInr,
        p_upi_id: upiId,
      });
      if (error) throw error;
      return data as ReferralWithdrawal;
    },
    onSuccess: async () => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['referralWithdrawals', userId] });
    },
  });

  const entries: WalletEntry[] = [
    ...(earnings.data ?? []).map((e) => ({
      kind: 'earning' as const,
      id: e.id,
      amount_inr: e.amount_inr,
      created_at: e.created_at,
    })),
    ...(withdrawals.data ?? []).map((w) => ({
      kind: 'withdrawal' as const,
      id: w.id,
      amount_inr: w.amount_inr,
      created_at: w.created_at,
      status: w.status,
      upi_id: w.upi_id,
    })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return {
    entries,
    earnings,
    withdrawals,
    withdraw,
    isLoading: earnings.isLoading || withdrawals.isLoading,
  };
}
