import { StyleSheet, Text, View } from 'react-native';
import { fonts, radius } from '../theme/tokens';

export function PlatformChip({ platform }: { platform: 'youtube' | 'instagram' }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.label}>{platform === 'youtube' ? '▶ Shorts' : '📷 Reels'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-start',
  },
  label: { color: '#fff', fontFamily: fonts.bodySemibold, fontSize: 10 },
});
