import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthProvider';
import { Badge, Btn, DetailEmpty, Field, ListRow, ListState, WorkPage } from '../components/ui';
import type { Video, VideoStatus } from '../types/database';

const FILTERS: { label: string; value: VideoStatus | 'all' }[] = [
  { label: 'Pending', value: 'pending' },
  { label: 'Flagged', value: 'flagged' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'All', value: 'all' },
];

export function Videos() {
  const [filter, setFilter] = useState<VideoStatus | 'all'>('pending');
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'));
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: videos, isLoading } = useQuery({
    queryKey: ['adminVideos', filter],
    queryFn: async () => {
      let query = supabase.from('videos').select('*').eq('is_deleted', false).order('created_at', { ascending: false });
      if (filter !== 'all') query = query.eq('status', filter);
      const { data, error } = await query;
      if (error) throw error;
      return data as Video[];
    },
  });

  // if a deep-linked id isn't in the current filter, widen to All so it shows
  useEffect(() => {
    const id = searchParams.get('id');
    if (id && videos && !videos.some((v) => v.id === id)) setFilter('all');
  }, [searchParams, videos]);

  const selected = videos?.find((v) => v.id === selectedId) ?? null;

  function select(id: string | null) {
    setSelectedId(id);
    setSearchParams(id ? { id } : {}, { replace: true });
  }

  const moderate = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: VideoStatus; reason?: string }) => {
      const { error } = await supabase
        .from('videos')
        .update({ status, rejection_reason: reason ?? null, moderated_by: profile?.id, moderated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminVideos'] });
      queryClient.invalidateQueries({ queryKey: ['vitals'] });
      queryClient.invalidateQueries({ queryKey: ['attentionQueue'] });
    },
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('videos').update({ is_deleted: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminVideos'] });
      select(null);
    },
  });

  const list = (
    <>
      <div className="sticky top-0 bg-bg border-b border-border px-3 py-2 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
              filter === f.value ? 'bg-surface text-text' : 'text-text-muted hover:text-text'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <ListState>Loading…</ListState>
      ) : !videos || videos.length === 0 ? (
        <ListState>Nothing here.</ListState>
      ) : (
        videos.map((v) => (
          <ListRow
            key={v.id}
            selected={v.id === selectedId}
            onClick={() => select(v.id)}
            title={v.title ?? 'Untitled submission'}
            subtitle={`${v.author_name ?? 'Unknown'} · ${v.platform}`}
            right={<Badge value={v.status} />}
          />
        ))
      )}
    </>
  );

  const detail = !selected ? (
    <DetailEmpty label="Select a video to moderate." />
  ) : (
    <div className="p-4 sm:p-6 max-w-2xl">
      <div className="flex gap-4">
        <div
          className="w-24 h-24 rounded-md shrink-0 bg-cover bg-center border border-border"
          style={{
            backgroundImage: selected.thumbnail_url ? `url(${selected.thumbnail_url})` : undefined,
            backgroundColor: selected.thumbnail_url ? undefined : '#5B18C9',
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-display font-semibold text-base leading-snug">{selected.title ?? 'Untitled submission'}</h2>
            <Badge value={selected.status} />
          </div>
          <p className="text-text-muted text-xs mt-1">
            {selected.author_name ?? 'Unknown'} · {selected.platform} · {selected.view_count_in_app} in-app views
            {selected.report_count > 0 && <span className="text-coral"> · {selected.report_count} reports</span>}
          </p>
          <a
            href={selected.original_url}
            target="_blank"
            rel="noreferrer"
            className="text-pink text-xs hover:underline mt-1.5 inline-block"
          >
            View original ↗
          </a>
        </div>
      </div>

      <div className="mt-5">
        <Field label="Submitted" mono>
          {new Date(selected.created_at).toLocaleString()}
        </Field>
        <Field label="Platform video id" mono>
          {selected.platform_video_id}
        </Field>
        {selected.rejection_reason && <Field label="Rejection reason">{selected.rejection_reason}</Field>}
      </div>

      {moderate.isError && <p className="text-coral text-sm mt-4">{(moderate.error as Error)?.message}</p>}

      <div className="flex flex-wrap gap-2 mt-5">
        {selected.status !== 'approved' && (
          <Btn variant="approve" onClick={() => moderate.mutate({ id: selected.id, status: 'approved' })}>
            Approve
          </Btn>
        )}
        {selected.status !== 'rejected' && (
          <Btn
            variant="reject"
            onClick={() => {
              const reason = window.prompt('Rejection reason (shown to the creator):');
              if (reason !== null) moderate.mutate({ id: selected.id, status: 'rejected', reason });
            }}
          >
            Reject
          </Btn>
        )}
        <Btn
          onClick={() => {
            if (window.confirm('Remove this video permanently from the feed?')) softDelete.mutate(selected.id);
          }}
        >
          Delete
        </Btn>
      </div>
    </div>
  );

  return (
    <WorkPage
      title="Video moderation"
      description="Approve, reject or remove submitted videos."
      list={list}
      detail={detail}
      selected={!!selected}
      onBack={() => select(null)}
    />
  );
}
