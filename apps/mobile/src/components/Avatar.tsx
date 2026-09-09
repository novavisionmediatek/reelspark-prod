import { Image, StyleSheet, Text, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts, gradient } from '../theme/tokens';

interface AvatarProps {
  initials: string;
  imageUri?: string | null;
  size?: number;
  style?: ViewStyle;
}

export function Avatar({ initials, imageUri, size = 34, style }: AvatarProps) {
  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={[styles.base, { width: size, height: size, borderRadius: size / 2 }, style] as any}
      />
    );
  }

  return (
    <LinearGradient
      colors={gradient.brand}
      locations={gradient.brandLocations}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.36 }]}>{initials}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontFamily: fonts.displaySemibold },
});
