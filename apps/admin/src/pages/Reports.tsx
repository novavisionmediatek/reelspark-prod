import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Badge, Btn, DetailEmpty, Field, ListRow, ListState, WorkPage } from '../components/ui';
import type { Report, Video } from '../types/database';

interface ReportRow extends Report {
  videos: Pick<Video, 'id' | 'title' | 'status'> | null;
}

export function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'));
  const queryClient = useQueryClient();

  const { data: reports, isLoading } = useQuery({
    queryKey: ['adminReports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*, videos(id, title, status)')
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as ReportRow[];
    },
  });

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) setSelectedId(id);
  }, [searchParams]);

  const selected = reports?.find((r) => r.id === selectedId) ?? null;

  function select(id: string | null) {
    setSelectedId(id);
    setSearchParams(id ? { id } : {}, { replace: true });
  }

  const resolve = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'reviewed' | 'dismissed' }) => {
      const { error } = await supabase.from('reports').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminReports'] });
      queryClient.invalidateQueries({ queryKey: ['vitals'] });
      queryClient.invalidateQueries({ queryKey: ['attentionQueue'] });
      select(null);
    },
  });

  const list = isLoading ? (
    <ListState>Loading…</ListState>
  ) : !reports || reports.length === 0 ? (
    <ListState>No open reports.</ListState>
  ) : (
    <>
      {reports.map((r) => (
        <ListRow
          key={r.id}
          selected={r.id === selectedId}
          onClick={() => select(r.id)}
          title={r.videos?.title ?? 'Video removed'}
          subtitle={r.reason.replace(/_/g, ' ')}
          right={<Badge value="open" />}
        />
      ))}
    </>
  );

  const detail = !selected ? (
    <DetailEmpty label="Select a report to review." />
  ) : (
    <div className="p-4 sm:p-6 max-w-2xl">
      <h2 className="font-display font-semibold text-base">{selected.videos?.title ?? 'Video removed'}</h2>

      <div className="mt-5">
        <Field label="Reason">{selected.reason.replace(/_/g, ' ')}</Field>
        {selected.notes && <Field label="Reporter notes">“{selected.notes}”</Field>}
        <Field label="Filed" mono>
          {new Date(selected.created_at).toLocaleString()}
        </Field>
        {selected.videos && (
          <Field label="Video status">
            <Badge value={selected.videos.status} />
          </Field>
        )}
      </div>

      {resolve.isError && <p className="text-coral text-sm mt-4">{(resolve.error as Error)?.message}</p>}

      <div className="flex flex-wrap gap-2 mt-5">
        <Btn variant="approve" onClick={() => resolve.mutate({ id: selected.id, status: 'reviewed' })}>
          Mark reviewed
        </Btn>
        <Btn onClick={() => resolve.mutate({ id: selected.id, status: 'dismissed' })}>Dismiss</Btn>
      </div>
    </div>
  );

  return (
    <WorkPage
      title="Reports"
      description="Open reports filed by users against videos."
      list={list}
      detail={detail}
      selected={!!selected}
      onBack={() => select(null)}
    />
  );
}
