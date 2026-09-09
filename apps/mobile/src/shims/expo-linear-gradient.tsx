import { View, type ViewProps } from 'react-native';

// Web replacement for `expo-linear-gradient`. Renders a react-native-web View
// with a CSS `linear-gradient` background, matching the small slice of the
// expo API this app actually uses (colors / locations / start / end).

interface Point {
  x: number;
  y: number;
}

export interface LinearGradientProps extends ViewProps {
  colors: readonly string[];
  locations?: readonly number[] | null;
  start?: Point | null;
  end?: Point | null;
}

export function LinearGradient({ colors, locations, start, end, style, ...rest }: LinearGradientProps) {
  const s = start ?? { x: 0.5, y: 0 };
  const e = end ?? { x: 0.5, y: 1 };

  // CSS gradient angle: 0deg points up, increasing clockwise.
  const angle = Math.round((Math.atan2(e.y - s.y, e.x - s.x) * 180) / Math.PI + 90);

  const stops = colors
    .map((color, i) => {
      const at = locations && locations[i] != null ? ` ${locations[i]! * 100}%` : '';
      return `${color}${at}`;
    })
    .join(', ');

  const backgroundImage = `linear-gradient(${angle}deg, ${stops})`;

  return <View {...rest} style={[style, { backgroundImage } as object]} />;
}

export default { LinearGradient };
