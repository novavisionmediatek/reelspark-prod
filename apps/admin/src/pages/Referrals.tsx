import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Badge, Btn, DetailEmpty, Field, ListRow, ListState, WorkPage } from '../components/ui';
import type { ReferralEarning, ReferralWithdrawal } from '../types/database';

const STATUSES = ['paid', 'failed', 'reversed'] as const;

export function Referrals() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'));
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const queryClient = useQueryClient();

  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ['adminWithdrawals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referral_withdrawals')
        .select(
          '*, user:profiles!referral_withdrawals_user_id_fkey (id, display_name, email, referral_code, referral_balance_inr)',
        )
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ReferralWithdrawal[];
    },
  });

  const { data: earnings } = useQuery({
    queryKey: ['adminReferralEarnings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('referral_earnings').select('referrer_id, amount_inr');
      if (error) throw error;
      return data as Pick<ReferralEarning, 'referrer_id' | 'amount_inr'>[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return withdrawals ?? [];
    return (withdrawals ?? []).filter((w) =>
      [w.user?.display_name, w.user?.email, w.user?.referral_code, w.upi_id]
        .some((v) => v?.toLowerCase().includes(q)),
    );
  }, [withdrawals, search]);

  const selected = withdrawals?.find((w) => w.id === selectedId) ?? null;

  // Totals for the currently selected user.
  const userRollup = useMemo(() => {
    if (!selected) return null;
    const uid = selected.user_id;
    const theirWithdrawals = (withdrawals ?? []).filter((w) => w.user_id === uid);
    const paidOut = theirWithdrawals
      .filter((w) => w.status === 'paid')
      .reduce((s, w) => s + w.amount_inr, 0);
    const earned = (earnings ?? [])
      .filter((e) => e.referrer_id === uid)
      .reduce((s, e) => s + e.amount_inr, 0);
    return { theirWithdrawals, paidOut, earned, count: theirWithdrawals.length };
  }, [selected, withdrawals, earnings]);

  const totals = useMemo(() => {
    const paid = (withdrawals ?? []).filter((w) => w.status === 'paid');
    return {
      paidAmount: paid.reduce((s, w) => s + w.amount_inr, 0),
      paidCount: paid.length,
      total: (withdrawals ?? []).length,
    };
  }, [withdrawals]);

  function select(id: string | null) {
    setSelectedId(id);
    setNote('');
    setReference('');
    setSearchParams(id ? { id } : {}, { replace: true });
  }

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.rpc('set_referral_withdrawal_status', {
        p_id: id,
        p_status: status,
        p_note: note.trim() || null,
        p_reference: reference.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminWithdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
  });

  const list = (
    <>
      <div className="sticky top-0 bg-bg border-b border-border p-3 space-y-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search user, email, code or UPI…"
          className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm outline-none focus:border-pink transition-colors"
        />
        <p className="font-mono text-[11px] text-text-muted">
          ₹{totals.paidAmount} paid out · {totals.paidCount}/{totals.total} withdrawals
        </p>
      </div>
      {isLoading ? (
        <ListState>Loading…</ListState>
      ) : filtered.length === 0 ? (
        <ListState>No withdrawals yet.</ListState>
      ) : (
        filtered.map((w) => (
          <ListRow
            key={w.id}
            selected={w.id === selectedId}
            onClick={() => select(w.id)}
            title={<span className="font-mono">₹{w.amount_inr}</span>}
            subtitle={`${w.user?.display_name ?? w.user?.email ?? w.user_id} · ${new Date(
              w.created_at,
            ).toLocaleDateString()}`}
            right={<Badge value={w.status} />}
          />
        ))
      )}
    </>
  );

  const detail = !selected ? (
    <DetailEmpty label="Select a withdrawal to inspect." />
  ) : (
    <div className="p-4 sm:p-6 max-w-2xl">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display font-semibold text-base">
            {selected.user?.display_name ?? selected.user?.email ?? selected.user_id}
          </h2>
          <p className="text-text-muted text-xs mt-0.5 truncate">{selected.user?.email}</p>
        </div>
        <Badge value={selected.status} />
      </div>

      <div className="mt-5">
        <Field label="Amount" mono>
          ₹{selected.amount_inr}
        </Field>
        <Field label="UPI ID" mono>
          {selected.upi_id}
        </Field>
        <Field label="Requested" mono>
          {new Date(selected.created_at).toLocaleString()}
        </Field>
        {selected.reviewed_at && (
          <Field label="Last reviewed" mono>
            {new Date(selected.reviewed_at).toLocaleString()}
          </Field>
        )}
        {selected.reference && (
          <Field label="Payout reference" mono>
            {selected.reference}
          </Field>
        )}
        {selected.admin_note && <Field label="Admin note">{selected.admin_note}</Field>}
      </div>

      {userRollup && (
        <div className="mt-6 border border-border rounded-md p-4">
          <h3 className="font-medium text-sm mb-3">This user’s referral wallet</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-sm">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-text-muted">Earned</div>
              <div className="mt-0.5">₹{userRollup.earned}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-text-muted">Paid out</div>
              <div className="mt-0.5">₹{userRollup.paidOut}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-text-muted">Balance</div>
              <div className="mt-0.5">₹{selected.user?.referral_balance_inr ?? 0}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-text-muted">Withdrawals</div>
              <div className="mt-0.5">{userRollup.count}</div>
            </div>
          </div>

          <div className="mt-4 divide-y divide-border/60">
            {userRollup.theirWithdrawals.map((w) => (
              <button
                key={w.id}
                onClick={() => select(w.id)}
                className={`w-full text-left flex items-center justify-between gap-3 py-2 text-xs ${
                  w.id === selected.id ? 'text-text' : 'text-text-muted hover:text-text'
                }`}
              >
                <span className="font-mono">₹{w.amount_inr}</span>
                <span className="truncate flex-1">{new Date(w.created_at).toLocaleString()}</span>
                <Badge value={w.status} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 border border-border rounded-md p-4">
        <h3 className="font-medium text-sm mb-1">Update status</h3>
        <p className="text-text-muted text-xs mb-3">
          Marking a paid withdrawal <span className="text-text">failed</span> or{' '}
          <span className="text-text">reversed</span> refunds ₹{selected.amount_inr} to the user’s referral
          balance. Re-marking it <span className="text-text">paid</span> debits it again.
        </p>
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Payout reference (optional)"
          className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-pink transition-colors mb-2"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Admin note (optional)"
          className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-pink transition-colors mb-3"
        />
        {setStatus.isError && (
          <p className="text-coral text-sm mb-3">{(setStatus.error as Error).message}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {STATUSES.filter((s) => s !== selected.status).map((s) => (
            <Btn
              key={s}
              variant={s === 'paid' ? 'approve' : 'reject'}
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate({ id: selected.id, status: s })}
            >
              Mark {s}
            </Btn>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <WorkPage
      title="Referrals"
      description="Every referral wallet withdrawal, across all users. Auto-approved on request; refunds on failure/reversal."
      list={list}
      detail={detail}
      selected={!!selected}
      onBack={() => select(null)}
    />
  );
}
