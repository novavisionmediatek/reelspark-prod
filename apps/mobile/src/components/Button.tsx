import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradient, radius, spacing } from '../theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
  const isDisabled = disabled || loading;

  if (variant === 'primary') {
    return (
      <Pressable onPress={onPress} disabled={isDisabled} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }, style]}>
        <LinearGradient
          colors={gradient.brand}
          locations={gradient.brandLocations}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.base, isDisabled && styles.disabled]}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryLabel}>{label}</Text>}
        </LinearGradient>
      </Pressable>
    );
  }

  if (variant === 'secondary') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [styles.base, styles.secondary, pressed && styles.secondaryPressed, isDisabled && styles.disabled, style]}
      >
        <Text style={styles.secondaryLabel}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} disabled={isDisabled} style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.6 }, style]}>
      <Text style={styles.ghostLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  primaryLabel: { color: '#fff', fontFamily: fonts.bodySemibold, fontSize: 15 },
  secondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: 'transparent' },
  secondaryPressed: { borderColor: colors.pink, backgroundColor: colors.surface },
  secondaryLabel: { color: colors.text, fontFamily: fonts.bodySemibold, fontSize: 15 },
  ghost: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, alignItems: 'center' },
  ghostLabel: { color: colors.pink, fontFamily: fonts.bodySemibold, fontSize: 14 },
});
