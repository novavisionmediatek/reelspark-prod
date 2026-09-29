import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { useAuth } from '../lib/AuthProvider';
import { useAppSettings } from '../hooks/useAppSettings';
import { useRegistrationPayment } from '../hooks/useRegistrationPayment';
import { useInitiatePhonePePayment, useCheckPhonePeStatus } from '../hooks/usePhonePePayment';
import { colors, fonts, radius, spacing, type } from '../theme/tokens';
import type { MainStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'Payment'>;

export function PaymentScreen({ navigation }: Props) {
  const { profile, refreshProfile } = useAuth();
  const { settings } = useAppSettings();
  const { data: payment } = useRegistrationPayment();
  const initiatePhonePe = useInitiatePhonePePayment();

  const [error, setError] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState('');
  const [phonePeProcessing, setPhonePeProcessing] = useState(false);

  const fee = settings.registration_fee_inr;
  const status = profile?.payment_status ?? 'unpaid';

  // While a payment is 'initiated', actively ask PhonePe whether it actually
  // went through — this is what drives approval, not just a passive wait.
  // Doing it here (rather than only on a separate /payment-callback route)
  // means it works no matter how the user gets back into the app after
  // paying, without depending on a redirect URL routing correctly.
  useCheckPhonePeStatus(payment?.status === 'initiated' ? payment.merchant_order_id : null);

  // Bridge the polled payment row to the profile gate.
  useEffect(() => {
    if (payment?.status === 'approved' && status !== 'approved') refreshProfile();
  }, [payment?.status, status, refreshProfile]);

  async function handlePhonePePayment() {
    setError(null);
    if (!userPhone.trim() || userPhone.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    try {
      setPhonePeProcessing(true);
      const result = await initiatePhonePe.mutateAsync({ userPhone: userPhone.trim() });
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
    } catch (e) {
      setError((e as Error)?.message ?? 'Could not initiate PhonePe payment. Please try again.');
    } finally {
      setPhonePeProcessing(false);
    }
  }

  // ---- approved -------------------------------------------------------
  if (status === 'approved') {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centerCard}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(125,39,227,0.18)' }]}>
            <Feather name="check-circle" size={26} color={colors.purple} />
          </View>
          <Text style={styles.cardTitle}>Registration approved</Text>
          <Text style={styles.cardBody}>You're all set – you can now submit your Shorts and Reels.</Text>
          <Button label="Go to Submit" onPress={() => navigation.navigate('Tabs', { screen: 'Submit' })} style={{ marginTop: spacing.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  // ---- unpaid / initiated / rejected — show the PhonePe form ------------
  const rejected = payment?.status === 'rejected';
  const referred = !!profile?.referred_by;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Complete registration</Text>
          <Text style={styles.subtitle}>
            A one-time ₹{fee} fee unlocks video posting. Pay with PhonePe below — registration unlocks automatically
            once your payment is confirmed.
          </Text>
        </View>

        {referred ? (
          <View style={styles.referralBox}>
            <Text style={styles.referralBoxTitle}>
              🎉 Congrats! You've got ₹{settings.referral_bonus_inr} on your referral
            </Text>
            <Text style={styles.referralBoxNote}>
              You joined with a friend's code. Complete your ₹{fee} registration below to lock it in.
            </Text>
          </View>
        ) : null}

        {rejected && payment ? (
          <View style={styles.rejectedBox}>
            <Text style={styles.rejectedTitle}>Previous payment was rejected</Text>
            {payment.admin_note ? <Text style={styles.rejectedNote}>"{payment.admin_note}"</Text> : null}
            <Text style={styles.rejectedNote}>You can retry the payment below.</Text>
          </View>
        ) : null}

        <View style={styles.phonePeForm}>
          <Text style={styles.payLabel}>Pay with PhonePe</Text>
          <Text style={styles.amount}>₹{fee}</Text>

          <Text style={styles.label}>Phone number</Text>
          <TextField
            value={userPhone}
            onChangeText={setUserPhone}
            placeholder="10-digit mobile number"
            keyboardType="phone-pad"
            maxLength={10}
          />
          <Button
            label={phonePeProcessing ? 'Processing...' : 'Pay with PhonePe'}
            onPress={handlePhonePePayment}
            disabled={!userPhone.trim() || phonePeProcessing}
            loading={phonePeProcessing}
            style={{ marginTop: spacing.lg }}
          />
        </View>

        {(error || initiatePhonePe.isError) ? (
          <Text style={styles.error}>{error ?? (initiatePhonePe.error as Error)?.message}</Text>
        ) : null}

        <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} />

        <View style={styles.legalRow}>
          <Text style={styles.legalNote}>By paying you agree to our </Text>
          {LEGAL_LINKS.map((link, i) => (
            <Text key={link.path}>
              <Text style={styles.legalLink} onPress={() => openLegal(link.path)}>
                {link.label}
              </Text>
              {i < LEGAL_LINKS.length - 1 ? <Text style={styles.legalNote}> · </Text> : null}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Public policy pages live as static HTML under /legal/*.html (see
// apps/mobile/assets/legal/), reachable from the PhonePe payment context.
const LEGAL_LINKS = [
  { label: 'Terms', path: 'terms.html' },
  { label: 'Refund Policy', path: 'refund.html' },
  { label: 'Privacy', path: 'privacy.html' },
] as const;

function openLegal(path: string) {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  Linking.openURL(`${base}/legal/${path}`).catch(() => {
    /* no handler available */
  });
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing['2xl'] },
  header: { gap: spacing.xs, marginBottom: spacing.lg, marginTop: spacing.sm },
  title: { ...type.h1, color: colors.text },
  subtitle: { ...type.bodySmall, color: colors.textMuted },

  centerCard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  cardTitle: { ...type.h3, color: colors.text, textAlign: 'center' },
  cardBody: { ...type.bodySmall, color: colors.textMuted, textAlign: 'center', maxWidth: 320 },

  payLabel: {
    ...type.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  amount: { fontFamily: fonts.monoSemibold, fontSize: 32, color: colors.text, marginTop: -spacing.xs, marginBottom: spacing.md },

  label: {
    ...type.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },

  error: { ...type.bodySmall, color: colors.coral, marginTop: spacing.sm },

  legalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  legalNote: { ...type.bodySmall, color: colors.textMuted },
  legalLink: { ...type.bodySmall, color: colors.textMuted, textDecorationLine: 'underline' },

  rejectedBox: {
    backgroundColor: 'rgba(254,73,64,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(254,73,64,0.4)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: 4,
  },
  rejectedTitle: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.coral },
  rejectedNote: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },

  referralBox: {
    backgroundColor: 'rgba(125,39,227,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(125,39,227,0.4)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: 4,
  },
  referralBoxTitle: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.text },
  referralBoxNote: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },

  phonePeForm: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
});
