import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthProvider';
import type { Video } from '../types/database';

export function useMyVideos() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ['myVideos', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('submitted_by', userId!)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Video[];
    },
  });
}
