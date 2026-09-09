export const colors = {
  background: '#09090B',
  surface: '#141418',
  surfaceRaised: '#1C1C22',
  border: '#29292F',
  text: '#FFFFFF',
  textMuted: '#A6A6B0',
  softSurface: '#F4F4F7',

  orange: '#FF651C',
  coral: '#FE4940',
  pink: '#FD3667',
  magenta: '#DB3293',
  purple: '#7D27E3',
  deepPurple: '#5B18C9',

  success: '#7D27E3',
  danger: '#FE4940',
  pending: '#DB3293',
} as const;

export const gradient = {
  brand: [colors.orange, colors.coral, colors.pink, colors.magenta, colors.purple] as const,
  brandLocations: [0, 0.25, 0.48, 0.7, 1] as const,
};

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 20,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export const fonts = {
  display: 'Unbounded_700Bold',
  displaySemibold: 'Unbounded_600SemiBold',
  displayMedium: 'Unbounded_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  mono: 'JetBrainsMono_500Medium',
  monoSemibold: 'JetBrainsMono_600SemiBold',
} as const;

export const type = {
  display: { fontFamily: fonts.display, fontSize: 32, lineHeight: 40 },
  h1: { fontFamily: fonts.displaySemibold, fontSize: 26, lineHeight: 34 },
  h2: { fontFamily: fonts.displaySemibold, fontSize: 22, lineHeight: 30 },
  h3: { fontFamily: fonts.displaySemibold, fontSize: 18, lineHeight: 26 },
  bodyLarge: { fontFamily: fonts.body, fontSize: 17, lineHeight: 26 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodySmall: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 12, lineHeight: 16 },
} as const;
