import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { PageHeader } from '../components/ui';

// PostgREST returns a single object for a to-one embed; supabase-js types it as an array.
function one<T>(x: T | T[] | null | undefined): T | undefined {
  return Array.isArray(x) ? x[0] : x ?? undefined;
}

async function fetchStats() {
  const [users, paid, balances, pending, approved, flagged, openReports] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('payment_status', 'approved'),
    supabase.from('profiles').select('referral_balance_inr').gt('referral_balance_inr', 0),
    supabase.from('videos').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('is_deleted', false),
    supabase.from('videos').select('*', { count: 'exact', head: true }).eq('status', 'approved').eq('is_deleted', false),
    supabase.from('videos').select('*', { count: 'exact', head: true }).eq('status', 'flagged').eq('is_deleted', false),
    supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'open'),
  ]);

  return {
    users: users.count ?? 0,
    paid: paid.count ?? 0,
    referralOwed: (balances.data ?? []).reduce((s, r) => s + (r.referral_balance_inr ?? 0), 0),
    pending: pending.count ?? 0,
    approved: approved.count ?? 0,
    flagged: flagged.count ?? 0,
    openReports: openReports.count ?? 0,
  };
}

type QueueItem = {
  id: string;
  kind: 'video' | 'report';
  to: string;
  title: string;
  sub: string;
  at: string;
};

async function fetchQueue(): Promise<QueueItem[]> {
  const [videos, reports] = await Promise.all([
    supabase
      .from('videos')
      .select('id, title, author_name, status, created_at')
      .in('status', ['pending', 'flagged'])
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('reports')
      .select('id, reason, created_at, videos(title)')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const items: QueueItem[] = [];
  for (const v of (videos.data ?? []) as any[]) {
    items.push({
      id: v.id,
      kind: 'video',
      to: `/videos?id=${v.id}`,
      title: v.title ?? 'Untitled submission',
      sub: `${v.status} · ${v.author_name ?? 'Unknown'}`,
      at: v.created_at,
    });
  }
  for (const r of (reports.data ?? []) as any[]) {
    items.push({
      id: r.id,
      kind: 'report',
      to: `/reports?id=${r.id}`,
      title: one<{ title?: string }>(r.videos)?.title ?? 'Reported video',
      sub: `report · ${String(r.reason).replace(/_/g, ' ')}`,
      at: r.created_at,
    });
  }
  return items.sort((a, b) => (a.at < b.at ? 1 : -1));
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="px-4 py-3 sm:px-5">
      <div className={`font-mono text-xl sm:text-2xl font-semibold leading-none ${accent ?? 'text-text'}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-text-muted mt-2">{label}</div>
    </div>
  );
}

const KIND_TAG: Record<QueueItem['kind'], string> = {
  video: 'text-pink border-magenta/40',
  report: 'text-orange-300 border-orange/40',
};

export function Dashboard() {
  const { data: stats } = useQuery({ queryKey: ['adminStats'], queryFn: fetchStats });
  const { data: queue, isLoading } = useQuery({ queryKey: ['attentionQueue'], queryFn: fetchQueue, refetchInterval: 30000 });

  return (
    <div>
      <PageHeader title="Overview" description="Everything waiting on you, in one place." />

      {/* vitals strip */}
      <div className="flex flex-wrap divide-x divide-border border-b border-border">
        <Stat label="Total users" value={stats?.users ?? 0} />
        <Stat label="Paid users" value={stats?.paid ?? 0} accent="text-purple" />
        <Stat label="Referral owed" value={`₹${stats?.referralOwed ?? 0}`} accent="text-orange" />
        <Stat label="Pending review" value={stats?.pending ?? 0} accent="text-pink" />
        <Stat label="Approved" value={stats?.approved ?? 0} />
        <Stat label="Flagged" value={stats?.flagged ?? 0} accent="text-orange" />
        <Stat label="Open reports" value={stats?.openReports ?? 0} accent="text-coral" />
      </div>

      {/* needs attention */}
      <div className="p-4 sm:p-6">
        <h2 className="text-[11px] uppercase tracking-wider text-text-muted mb-3">Needs attention</h2>

        {isLoading ? (
          <p className="text-text-muted text-sm">Loading…</p>
        ) : !queue || queue.length === 0 ? (
          <div className="border border-border rounded-md px-4 py-10 text-center text-text-muted text-sm">
            All clear — nothing in the queue.
          </div>
        ) : (
          <div className="border border-border rounded-md divide-y divide-border/60 max-w-3xl">
            {queue.map((item) => (
              <Link
                key={`${item.kind}-${item.id}`}
                to={item.to}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface/50 transition-colors"
              >
                <span
                  className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${KIND_TAG[item.kind]}`}
                >
                  {item.kind}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{item.title}</div>
                  <div className="text-[11px] text-text-muted truncate">{item.sub}</div>
                </div>
                <span className="shrink-0 text-text-muted text-xs">→</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
