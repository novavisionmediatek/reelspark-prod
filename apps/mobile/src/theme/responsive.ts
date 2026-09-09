import { useWindowDimensions } from 'react-native';

// Width breakpoints (px). Phone is the base design; tablet/desktop layer on top.
export const BREAKPOINTS = {
  tablet: 768,
  sidebar: 1000,
  desktop: 1024,
  wide: 1440,
} as const;

export interface Responsive {
  width: number;
  height: number;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWide: boolean;
  /** tablet or larger */
  atLeastTablet: boolean;
  /** show the left nav rail instead of a bottom tab bar (>= 1000px) */
  sidebarNav: boolean;
  /** feed renders as a centered 9:16 phone-frame column with wheel/key nav (>= 1000px) */
  feedDesktop: boolean;
  /** columns for card grids (My Videos) */
  gridColumns: number;
}

// react-native-web's useWindowDimensions subscribes to window resize, so every
// consumer re-renders as the viewport changes.
export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();

  const isTablet = width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop;
  const isDesktop = width >= BREAKPOINTS.desktop;
  const isWide = width >= BREAKPOINTS.wide;

  return {
    width,
    height,
    isPhone: width < BREAKPOINTS.tablet,
    isTablet,
    isDesktop,
    isWide,
    atLeastTablet: width >= BREAKPOINTS.tablet,
    sidebarNav: width >= BREAKPOINTS.sidebar,
    feedDesktop: width >= BREAKPOINTS.sidebar,
    gridColumns: isWide ? 4 : isDesktop ? 3 : isTablet ? 2 : 1,
  };
}
