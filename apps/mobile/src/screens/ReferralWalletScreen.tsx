import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { useAuth } from '../lib/AuthProvider';
import { useAppSettings } from '../hooks/useAppSettings';
import { useReferralWallet } from '../hooks/useReferralWallet';
import { colors, fonts, radius, spacing, type } from '../theme/tokens';
import type { ReferralWithdrawalStatus } from '../types/database';
import type { ProfileStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ReferralWallet'>;

const UPI_RE = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z][a-zA-Z0-9.-]+$/;

const STATUS_LABEL: Record<ReferralWithdrawalStatus, string> = {
  paid: 'Paid',
  failed: 'Failed',
  reversed: 'Reversed',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ReferralWalletScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const { settings } = useAppSettings();
  const { entries, isLoading, withdraw } = useReferralWallet();

  const balance = profile?.referral_balance_inr ?? 0;
  const min = settings.min_referral_withdrawal_inr ?? 150;
  const canWithdraw = balance >= min;

  const [amount, setAmount] = useState('');
  const [upi, setUpi] = useState('');
  const [done, setDone] = useState<number | null>(null);

  // Pre-fill the amount with the full balance so the form is ready to submit;
  // leave it alone once the user has typed their own value.
  useEffect(() => {
    if (canWithdraw) setAmount((a) => (a === '' ? String(balance) : a));
  }, [canWithdraw, balance]);

  const amountNum = parseInt(amount, 10);
  const amountValid = Number.isFinite(amountNum) && amountNum >= min && amountNum <= balance;
  const upiValid = UPI_RE.test(upi.trim());

  const errorText = useMemo(() => {
    if (!withdraw.isError) return null;
    return (withdraw.error as Error).message || 'Could not process the withdrawal.';
  }, [withdraw.isError, withdraw.error]);

  // Why the submit button is disabled, so it never looks silently broken.
  const blockedReason = withdraw.isPending
    ? null
    : !amount
      ? 'Enter an amount to withdraw.'
      : !Number.isFinite(amountNum) || amountNum < min
        ? `Enter at least ₹${min}.`
        : amountNum > balance
          ? `You only have ₹${balance} to withdraw.`
          : !upi.trim()
            ? 'Enter your UPI ID.'
            : !upiValid
              ? 'That UPI ID doesn’t look right — check it (e.g. name@bank).'
              : null;

  function submit() {
    setDone(null);
    withdraw.mutate(
      { amountInr: amountNum, upiId: upi.trim() },
      {
        onSuccess: (row) => {
          setDone(row.amount_inr);
          setAmount('');
          setUpi('');
        },
      },
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Referral wallet</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Referral balance</Text>
          <Text style={styles.balanceNum}>₹{balance}</Text>
          <Text style={styles.balanceHint}>
            Withdrawals are sent to your UPI ID automatically. Minimum ₹{min}.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Withdraw</Text>
        {!canWithdraw ? (
          <Text style={styles.helpText}>
            You need ₹{Math.max(0, min - balance)} more in referral earnings before you can withdraw.
          </Text>
        ) : (
          <View style={styles.form}>
            <Text style={styles.fieldLabel}>Amount (₹)</Text>
            <TextField
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
              placeholder={String(balance)}
              keyboardType="numeric"
              inputMode="numeric"
              valid={amountValid}
            />
            <Pressable onPress={() => setAmount(String(balance))} hitSlop={8}>
              <Text style={styles.maxLink}>Withdraw all — ₹{balance}</Text>
            </Pressable>

            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>UPI ID</Text>
            <TextField
              value={upi}
              onChangeText={setUpi}
              placeholder="name@bank"
              autoCapitalize="none"
              autoCorrect={false}
              valid={upiValid}
            />

            {errorText && <Text style={styles.errorText}>{errorText}</Text>}
            {done != null && (
              <Text style={styles.successText}>
                ₹{done} is on its way to your UPI ID. It shows below as a withdrawal.
              </Text>
            )}

            <Button
              label={
                withdraw.isPending
                  ? 'Processing…'
                  : amountValid
                    ? `Withdraw ₹${amountNum}`
                    : 'Withdraw'
              }
              onPress={submit}
              loading={withdraw.isPending}
              disabled={!amountValid || !upiValid || withdraw.isPending}
              style={{ marginTop: spacing.md }}
            />
            {blockedReason && <Text style={styles.blockedText}>{blockedReason}</Text>}
          </View>
        )}

        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Transactions</Text>
        {isLoading ? (
          <Text style={styles.helpText}>Loading…</Text>
        ) : entries.length === 0 ? (
          <Text style={styles.helpText}>
            No referral activity yet. You earn ₹{settings.referral_bonus_inr} each time a friend registers
            with your code.
          </Text>
        ) : (
          <View style={styles.card}>
            {entries.map((e, i) => (
              <View key={`${e.kind}-${e.id}`} style={[styles.txnRow, i > 0 && styles.rowDivider]}>
                <View style={styles.txnText}>
                  <Text style={styles.txnTitle}>
                    {e.kind === 'earning' ? 'Referral bonus' : `Withdrawal to ${e.upi_id}`}
                  </Text>
                  <Text style={styles.txnSub}>
                    {fmtDate(e.created_at)}
                    {e.kind === 'withdrawal' && e.status !== 'paid'
                      ? ` · ${STATUS_LABEL[e.status]}`
                      : ''}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.txnAmount,
                    e.kind === 'earning'
                      ? styles.credit
                      : e.status === 'paid'
                        ? styles.debit
                        : styles.reversed,
                  ]}
                >
                  {e.kind === 'earning' ? '+' : e.status === 'paid' ? '−' : ''}₹{e.amount_inr}
                </Text>
              </View>
            ))}
          </View>
        )}
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
  balanceCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 4,
  },
  balanceLabel: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  balanceNum: { color: colors.text, fontFamily: fonts.monoSemibold, fontSize: 30 },
  balanceHint: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  sectionLabel: {
    ...type.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  helpText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  form: { gap: spacing.xs },
  fieldLabel: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, marginBottom: 4 },
  maxLink: { color: colors.pink, fontFamily: fonts.bodyMedium, fontSize: 12, marginTop: 6 },
  errorText: { color: colors.coral, fontFamily: fonts.body, fontSize: 12, marginTop: spacing.sm },
  blockedText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 11.5,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  successText: { color: colors.purple, fontFamily: fonts.body, fontSize: 12, marginTop: spacing.sm, lineHeight: 17 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 14,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  txnText: { flex: 1, gap: 3 },
  txnTitle: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 13 },
  txnSub: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11 },
  txnAmount: { fontFamily: fonts.monoSemibold, fontSize: 14 },
  credit: { color: colors.purple },
  debit: { color: colors.text },
  reversed: { color: colors.textMuted },
});
