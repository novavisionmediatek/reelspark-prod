import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { colors, fonts, gradient, spacing, type } from '../../theme/tokens';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <LinearGradient
        colors={['rgba(253,54,103,0.35)', 'transparent']}
        style={styles.glow}
        pointerEvents="none"
      />

      <View style={styles.top}>
        <Logo size={56} />
        <View style={styles.wordmarkRow}>
          <Text style={styles.wordmark}>Reel</Text>
          <Text style={[styles.wordmark, styles.wordmarkAccent]}>Spark</Text>
        </View>
        <Text style={styles.headline}>Boost your Shorts.{'\n'}Spark your audience.</Text>
        <Text style={styles.copy}>
          Submit your own YouTube Shorts or Instagram Reels and get real people
          watching — from creators who watch back.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button label="Create account" onPress={() => navigation.navigate('SignUp')} />
        <Button label="I already have an account" variant="secondary" onPress={() => navigation.navigate('Login')} />
        <Text style={styles.legal}>By continuing you agree to our Terms &amp; Privacy Policy</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    backgroundColor: colors.background,
    justifyContent: 'flex-end',
    padding: spacing.xl,
  },
  glow: { position: 'absolute', top: '10%', left: '20%', width: 280, height: 280, borderRadius: 140 },
  top: { flex: 1, justifyContent: 'center', gap: spacing.md },
  wordmarkRow: { flexDirection: 'row', marginTop: spacing.sm },
  wordmark: { ...type.h2, color: colors.text },
  wordmarkAccent: { color: gradient.brand[2] },
  headline: { ...type.h1, color: colors.text, marginTop: spacing.sm },
  copy: { ...type.bodySmall, color: colors.textMuted, maxWidth: 280, lineHeight: 21 },
  actions: { gap: spacing.md, paddingBottom: spacing.lg },
  legal: { ...type.bodySmall, color: colors.textMuted, textAlign: 'center', fontSize: 11 },
});
