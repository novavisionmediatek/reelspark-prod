import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthProvider';
import { detectPlatform } from '../lib/urlParsers';
import { fetchYouTubeOEmbed } from '../lib/youtubeOembed';

export function useSubmitVideo() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (url: string) => {
      const { platform, videoId } = detectPlatform(url);
      if (!platform || !videoId) throw new Error('Unrecognized video URL.');
      if (!session?.user) throw new Error('You must be logged in to submit a video.');

      let title: string | null = null;
      let authorName: string | null = null;
      let thumbnailUrl: string | null = null;

      if (platform === 'youtube') {
        const meta = await fetchYouTubeOEmbed(url);
        title = meta.title;
        authorName = meta.authorName;
        thumbnailUrl = meta.thumbnailUrl;
      }
      // Instagram oEmbed needs a Meta access token server-side (PROJECT_PLAN.md §5) —
      // submissions proceed without fetched metadata until that Edge Function exists.

      const { error } = await supabase.from('videos').insert({
        submitted_by: session.user.id,
        platform,
        original_url: url,
        platform_video_id: videoId,
        canonical_url: url,
        title,
        author_name: authorName,
        thumbnail_url: thumbnailUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myVideos'] });
    },
  });
}
