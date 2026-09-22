import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../theme/tokens';

export function OrDivider() {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <Text style={styles.text}>or</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.sm },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  text: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
});
