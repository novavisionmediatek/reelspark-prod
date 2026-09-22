import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme/tokens';
import { signInWithGoogle } from '../lib/googleAuth';

interface Props {
  onError: (message: string) => void;
}

// The app's `@expo/vector-icons` shim (vite.config.ts alias -> src/shims/vector-icons.tsx)
// only implements Feather/Ionicons glyphs, so the Google mark is drawn inline
// here the same way the rest of the shim draws icons.
function GoogleMark() {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

export function GoogleButton({ onError }: Props) {
  const [loading, setLoading] = useState(false);

  async function handlePress() {
    setLoading(true);
    try {
      await signInWithGoogle();
      // On success the browser navigates away to Google's consent screen, so
      // there's nothing to reset here — this component unmounts.
    } catch (err) {
      setLoading(false);
      onError(err instanceof Error ? err.message : 'Could not start Google sign-in.');
    }
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      onPress={handlePress}
      disabled={loading}
      accessibilityLabel="Continue with Google"
    >
      <GoogleMark />
      <Text style={styles.label}>{loading ? 'Redirecting…' : 'Continue with Google'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 13,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.85 },
  label: { color: colors.text, fontFamily: fonts.bodySemibold, fontSize: 15 },
});
