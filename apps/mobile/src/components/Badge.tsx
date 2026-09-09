import { StyleSheet, Text, View } from 'react-native';
import { fonts, radius } from '../theme/tokens';

export type VideoStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

const STATUS_STYLES: Record<VideoStatus, { bg: string; border: string; fg: string; label: string }> = {
  approved: { bg: 'rgba(125,39,227,0.18)', border: 'rgba(125,39,227,0.5)', fg: '#B78CF5', label: 'Approved' },
  pending: { bg: 'rgba(219,50,147,0.18)', border: 'rgba(219,50,147,0.5)', fg: '#F291C6', label: 'Pending review' },
  rejected: { bg: 'rgba(254,73,64,0.18)', border: 'rgba(254,73,64,0.5)', fg: '#FF9D96', label: 'Rejected' },
  flagged: { bg: 'rgba(255,101,28,0.18)', border: 'rgba(255,101,28,0.5)', fg: '#FFB27E', label: 'Flagged' },
};

export function StatusBadge({ status }: { status: VideoStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg, borderColor: s.border }]}>
      <Text style={[styles.text, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
