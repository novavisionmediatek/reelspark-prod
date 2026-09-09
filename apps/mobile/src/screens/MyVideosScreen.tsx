import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { StatusBadge } from '../components/Badge';
import { colors, fonts, gradient, spacing, type } from '../theme/tokens';
import { useResponsive } from '../theme/responsive';
import { useMyVideos } from '../hooks/useMyVideos';
import type { MainTabParamList } from '../navigation/types';
import type { Video } from '../types/database';

type Props = BottomTabScreenProps<MainTabParamList, 'MyVideos'>;

const ROW_GRADIENTS: [string, string][] = [
  [colors.orange, colors.pink],
  [colors.magenta, colors.deepPurple],
  [colors.coral, colors.purple],
];

function VideoRow({ video, index, columns }: { video: Video; index: number; columns: number }) {
  const [from, to] = ROW_GRADIENTS[index % ROW_GRADIENTS.length];
  return (
    <Pressable
      style={[styles.row, columns > 1 && { flex: 1, maxWidth: `${100 / columns}%` as `${number}%` }]}
    >
      <LinearGradient colors={[from, to]} style={styles.thumb} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {video.title ?? 'Untitled submission'}
        </Text>
        <View style={styles.rowMeta}>
          <StatusBadge status={video.status} />
          {video.status === 'approved' && <Text style={styles.rowViews}>{video.view_count_in_app} views</Text>}
        </View>
        {video.rejection_reason && <Text style={styles.rowReason}>Reason: {video.rejection_reason}</Text>}
      </View>
    </Pressable>
  );
}

export function MyVideosScreen({ navigation }: Props) {
  const { data: videos, isLoading, isError } = useMyVideos();
  const { gridColumns } = useResponsive();

  const totalViews = (videos ?? []).reduce((sum, v) => sum + v.view_count_in_app, 0);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>My videos</Text>
        {videos && (
          <Text style={styles.statLine}>
            <Text style={styles.statNumber}>{videos.length}</Text> submissions ·{' '}
            <Text style={styles.statNumber}>{totalViews}</Text> in-app views total
          </Text>
        )}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.pink} />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Couldn't load your videos.</Text>
        </View>
      ) : videos && videos.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Nothing submitted yet</Text>
          <Text style={styles.emptyText}>Tap the + button to submit your first Short or Reel.</Text>
        </View>
      ) : (
        <FlatList
          // numColumns can't change without a fresh list instance.
          key={`grid-${gridColumns}`}
          data={videos}
          keyExtractor={(item) => item.id}
          numColumns={gridColumns}
          columnWrapperStyle={gridColumns > 1 ? styles.column : undefined}
          renderItem={({ item, index }) => <VideoRow video={item} index={index} columns={gridColumns} />}
          contentContainerStyle={styles.list}
        />
      )}

      <Pressable style={styles.fab} onPress={() => navigation.navigate('Submit')} accessibilityLabel="Submit new video">
        <LinearGradient colors={gradient.brand} locations={gradient.brandLocations} style={styles.fabInner}>
          <Feather name="plus" size={22} color="#fff" />
        </LinearGradient>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    backgroundColor: colors.background,
  },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: 4 },
  title: { ...type.h2, color: colors.text },
  statLine: { fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted },
  statNumber: { color: colors.text },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.xs },
  emptyTitle: { color: colors.text, fontFamily: fonts.displaySemibold, fontSize: 16 },
  emptyText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },
  list: { padding: spacing.xl, gap: spacing.md },
  column: { gap: spacing.md, alignItems: 'stretch' },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
  },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  rowInfo: { flex: 1, justifyContent: 'center', gap: 4 },
  rowTitle: { color: colors.text, fontFamily: fonts.bodySemibold, fontSize: 13 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowViews: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: 11 },
  rowReason: { color: colors.coral, fontFamily: fonts.body, fontSize: 10.5, marginTop: 2 },
  fab: { position: 'absolute', right: spacing.xl, bottom: spacing.xl },
  fabInner: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
