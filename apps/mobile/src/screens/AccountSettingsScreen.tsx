import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { useAuth } from '../lib/AuthProvider';
import { supabase } from '../lib/supabase';
import { colors, fonts, radius, spacing, type } from '../theme/tokens';
import type { ProfileStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AccountSettings'>;

type ResetState = 'idle' | 'sending' | 'sent' | 'error';

export function AccountSettingsScreen({ navigation }: Props) {
  const { session, profile } = useAuth();
  const email = session?.user?.email ?? profile?.email ?? '—';
  const [resetState, setResetState] = useState<ResetState>('idle');

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : null;

  async function sendPasswordReset() {
    if (!session?.user?.email || resetState === 'sending') return;
    setResetState('sending');
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(session.user.email, { redirectTo });
    setResetState(error ? 'error' : 'sent');
  }

  function handleLogout() {
    const confirmed = typeof window === 'undefined' || window.confirm('Log out of ReelSpark?');
    if (confirmed) supabase.auth.signOut();
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Account settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue}>{email}</Text>
          </View>
          {memberSince && (
            <View style={[styles.row, styles.rowDivider]}>
              <Text style={styles.rowLabel}>Member since</Text>
              <Text style={styles.rowValue}>{memberSince}</Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionLabel}>Password</Text>
        <Text style={styles.helpText}>
          We&apos;ll email you a secure link to choose a new password.
        </Text>
        <Button
          label={resetState === 'sending' ? 'Sending…' : 'Send password reset email'}
          variant="secondary"
          onPress={sendPasswordReset}
          loading={resetState === 'sending'}
          disabled={!session?.user?.email}
          style={{ marginTop: spacing.sm }}
        />
        {resetState === 'sent' && (
          <Text style={styles.successText}>Reset link sent to {email}.</Text>
        )}
        {resetState === 'error' && (
          <Text style={styles.errorText}>Could not send the reset email. Try again in a moment.</Text>
        )}

        <View style={styles.spacer} />

        <Button label="Log out" variant="ghost" onPress={handleLogout} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center', backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: { ...type.h3, color: colors.text },
  content: { padding: spacing.xl, gap: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: spacing.md,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowLabel: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13 },
  rowValue: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 13, flexShrink: 1, textAlign: 'right' },
  sectionLabel: {
    ...type.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  helpText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  successText: { color: colors.purple, fontFamily: fonts.body, fontSize: 12, marginTop: spacing.sm },
  errorText: { color: colors.coral, fontFamily: fonts.body, fontSize: 12, marginTop: spacing.sm },
  spacer: { height: spacing['2xl'] },
});
