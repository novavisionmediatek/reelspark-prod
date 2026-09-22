import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthProvider';
import { isValidPhone } from '../../lib/phone';
import { colors, spacing, type } from '../../theme/tokens';

export function CompleteProfileScreen() {
  const { profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(() => profile?.display_name ?? '');
  const [phone, setPhone] = useState(() => profile?.phone ?? '');
  const [youtubeHandle, setYoutubeHandle] = useState(() => profile?.youtube_handle ?? '');
  const [instagramHandle, setInstagramHandle] = useState(() => profile?.instagram_handle ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!displayName.trim()) {
      setError('Add a display name to continue.');
      return;
    }
    const trimmedPhone = phone.trim();
    if (!isValidPhone(trimmedPhone)) {
      setError('Enter a valid phone number to continue.');
      return;
    }
    setError(null);
    setLoading(true);
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setLoading(false);
      setError('Your session expired — please log in again.');
      return;
    }

    // .update() affecting zero rows isn't an error PostgREST reports — without
    // checking the returned row, a missing profile (e.g. an admin data wipe)
    // would fail silently here and loop this screen forever with no clue why.
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        phone: trimmedPhone,
        youtube_handle: youtubeHandle.trim() || null,
        instagram_handle: instagramHandle.trim() || null,
      })
      .eq('id', data.user.id)
      .select('id')
      .maybeSingle();
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (!updated) {
      setError('Your account profile is missing. Please contact support.');
      return;
    }
    // RootNavigator switches to MainTabs automatically once profile.display_name is set.
    await refreshProfile();
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Complete your profile</Text>
        <Text style={styles.subtitle}>Just a couple details before you submit your first video.</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Display name</Text>
        <TextField value={displayName} onChangeText={setDisplayName} placeholder="Marcus Reyes" />

        <Text style={styles.label}>Phone number</Text>
        <TextField value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+1 555 000 0000" />

        <Text style={styles.label}>YouTube handle (optional)</Text>
        <TextField value={youtubeHandle} onChangeText={setYoutubeHandle} autoCapitalize="none" placeholder="@marcusfilms" />

        <Text style={styles.label}>Instagram handle (optional)</Text>
        <TextField value={instagramHandle} onChangeText={setInstagramHandle} autoCapitalize="none" placeholder="@marcus.edits" />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label="Continue" onPress={handleContinue} loading={loading} style={{ marginTop: spacing.lg }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  header: { marginTop: spacing.xl, gap: spacing.xs, marginBottom: spacing.xl },
  title: { ...type.h1, color: colors.text },
  subtitle: { ...type.bodySmall, color: colors.textMuted },
  form: { gap: spacing.sm },
  label: { ...type.label, color: colors.textMuted, textTransform: 'uppercase', marginTop: spacing.md, marginBottom: spacing.xs },
  error: { ...type.bodySmall, color: colors.coral, marginTop: spacing.sm },
});
