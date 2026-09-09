import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthProvider';

export interface ProfileUpdate {
  display_name?: string;
  bio?: string | null;
  phone?: string | null;
  youtube_handle?: string | null;
  instagram_handle?: string | null;
}

export function useUpdateProfile() {
  const { session, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: ProfileUpdate) => {
      if (!session?.user) throw new Error('Not logged in.');
      const { error } = await supabase.from('profiles').update(updates).eq('id', session.user.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['myVideos'] });
    },
  });
}

export function useUploadAvatar() {
  const { session, refreshProfile } = useAuth();

  return useMutation({
    mutationFn: async (localUri: string) => {
      if (!session?.user) throw new Error('Not logged in.');

      const response = await fetch(localUri);
      const arrayBuffer = await response.arrayBuffer();
      const path = `${session.user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
      // Cache-bust so the new image shows immediately instead of a stale CDN copy.
      const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', session.user.id);
      if (updateError) throw updateError;

      return avatarUrl;
    },
    onSuccess: async () => {
      await refreshProfile();
    },
  });
}
