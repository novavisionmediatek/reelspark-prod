import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNotificationPrefs, type NotificationPrefs } from '../hooks/useNotificationPrefs';
import { colors, fonts, radius, spacing, type } from '../theme/tokens';
import type { ProfileStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Notifications'>;

const ITEMS: { key: keyof NotificationPrefs; title: string; description: string }[] = [
  {
    key: 'videoStatus',
    title: 'Video decisions',
    description: 'When a submission is approved, rejected, or flagged.',
  },
  {
    key: 'referralRewards',
    title: 'Referral rewards',
    description: 'When a friend registers with your code and you earn a bonus.',
  },
  {
    key: 'productUpdates',
    title: 'Product updates',
    description: 'Occasional news about new ReelSpark features.',
  },
];

export function NotificationsScreen({ navigation }: Props) {
  const { prefs, setPref } = useNotificationPrefs();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>Choose what ReelSpark can notify you about on this device.</Text>

        <View style={styles.card}>
          {ITEMS.map((item, i) => (
            <View key={item.key} style={[styles.row, i > 0 && styles.rowDivider]}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowDescription}>{item.description}</Text>
              </View>
              <Switch
                value={prefs[item.key]}
                onValueChange={(v) => setPref(item.key, v)}
                trackColor={{ false: colors.border, true: colors.pink }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>
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
  content: { padding: spacing.xl, gap: spacing.md },
  intro: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },
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
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 13.5 },
  rowDescription: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16 },
});
