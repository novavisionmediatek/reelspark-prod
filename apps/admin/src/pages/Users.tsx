import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthProvider';
import { Badge, Btn, DetailEmpty, Field, ListRow, ListState, WorkPage } from '../components/ui';
import type { Profile } from '../types/database';

export function Users() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { profile: currentAdmin } = useAuth();

  const { data: users, isLoading } = useQuery({
    queryKey: ['adminUsers', search],
    queryFn: async () => {
      let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (search.trim()) query = query.or(`display_name.ilike.%${search}%,email.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as Profile[];
    },
  });

  const selected = users?.find((u) => u.id === selectedId) ?? null;

  const toggleBan = useMutation({
    mutationFn: async (user: Profile) => {
      const banning = !user.is_banned;
      const reason = banning ? window.prompt('Ban reason:') ?? undefined : null;
      const { error } = await supabase
        .from('profiles')
        .update({ is_banned: banning, banned_reason: reason, banned_at: banning ? new Date().toISOString() : null })
        .eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminUsers'] }),
  });

  const toggleAdmin = useMutation({
    mutationFn: async (user: Profile) => {
      const nextRole = user.role === 'admin' ? 'user' : 'admin';
      const { error } = await supabase.from('profiles').update({ role: nextRole }).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminUsers'] }),
  });

  function handleToggleAdmin(user: Profile) {
    const makingAdmin = user.role !== 'admin';
    const isSelf = user.id === currentAdmin?.id;
    if (isSelf && !makingAdmin) {
      if (!window.confirm('This removes your own admin access and signs you out. Continue?')) return;
    } else if (!window.confirm(`${makingAdmin ? 'Grant' : 'Remove'} admin access for ${user.email}?`)) {
      return;
    }
    toggleAdmin.mutate(user, {
      onSuccess: () => {
        if (isSelf && !makingAdmin) supabase.auth.signOut();
      },
    });
  }

  const list = (
    <>
      <div className="sticky top-0 bg-bg border-b border-border p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm outline-none focus:border-pink transition-colors"
        />
      </div>
      {isLoading ? (
        <ListState>Loading…</ListState>
      ) : !users || users.length === 0 ? (
        <ListState>No users found.</ListState>
      ) : (
        users.map((u) => (
          <ListRow
            key={u.id}
            selected={u.id === selectedId}
            onClick={() => setSelectedId(u.id)}
            title={u.display_name ?? u.email ?? '—'}
            subtitle={u.email ?? ''}
            right={
              u.is_banned ? (
                <span className="text-[10px] font-bold uppercase text-coral">Banned</span>
              ) : u.role !== 'user' ? (
                <span className="text-[10px] font-bold uppercase text-purple-300">{u.role}</span>
              ) : null
            }
          />
        ))
      )}
    </>
  );

  const detail = !selected ? (
    <DetailEmpty label="Select a user." />
  ) : (
    <div className="p-4 sm:p-6 max-w-2xl">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display font-semibold text-base">{selected.display_name ?? '—'}</h2>
          <p className="text-text-muted text-xs mt-0.5 truncate">{selected.email}</p>
        </div>
        {selected.is_banned && <Badge value="rejected" />}
      </div>

      <div className="mt-5">
        <Field label="Role">{selected.role}</Field>
        <Field label="Registration">
          <Badge value={selected.payment_status ?? 'unpaid'} />
        </Field>
        <Field label="Referral code" mono>
          {selected.referral_code}
        </Field>
        <Field label="Referral balance" mono>
          ₹{selected.referral_balance_inr ?? 0}
        </Field>
        <Field label="Referred by another user">{selected.referred_by ? 'Yes' : 'No'}</Field>
        {selected.is_banned && selected.banned_reason && <Field label="Ban reason">{selected.banned_reason}</Field>}
        <Field label="Joined" mono>
          {new Date(selected.created_at).toLocaleString()}
        </Field>
      </div>

      <div className="flex flex-wrap gap-2 mt-5">
        <Btn
          variant={selected.role === 'admin' ? 'neutral' : 'approve'}
          onClick={() => handleToggleAdmin(selected)}
        >
          {selected.role === 'admin' ? 'Revoke admin' : 'Make admin'}
        </Btn>
        <Btn variant={selected.is_banned ? 'approve' : 'reject'} onClick={() => toggleBan.mutate(selected)}>
          {selected.is_banned ? 'Unban' : 'Ban'}
        </Btn>
      </div>
    </div>
  );

  return (
    <WorkPage
      title="Users"
      description="Search accounts, manage admin access and bans."
      list={list}
      detail={detail}
      selected={!!selected}
      onBack={() => setSelectedId(null)}
    />
  );
}
