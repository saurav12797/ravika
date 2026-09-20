/**
 * Ravika design tokens - playful romantic palette (rose / coral / cream).
 */

export const Colors = {
  // Brand
  rose: '#E85A7A',
  roseDark: '#C43D5C',
  roseLight: '#F7A8B8',
  coral: '#FF7A59',
  coralSoft: '#FFB199',
  cream: '#FFF6EE',
  creamDark: '#F5E6D8',
  blush: '#FFE4EC',
  peach: '#FFE8DE',

  // Neutrals
  ink: '#2A1F24',
  inkMuted: '#6B5560',
  inkSubtle: '#9A8790',
  border: '#F0D9E0',
  borderStrong: '#E5C4CE',
  white: '#FFFFFF',
  black: '#000000',

  // Semantic
  success: '#2F9E6B',
  successSoft: '#E6F7EF',
  warning: '#D97706',
  warningSoft: '#FFF4E5',
  danger: '#D64545',
  dangerSoft: '#FDECEC',
  info: '#3B82A0',
  infoSoft: '#E8F4F8',

  // Surfaces
  background: '#FFF6EE',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFBF8',
  overlay: 'rgba(42, 31, 36, 0.45)',

  // Presence
  online: '#2F9E6B',
  recently: '#E8A317',
  offline: '#9A8790',
} as const;

export type ColorToken = keyof typeof Colors;

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

export type SpacingToken = keyof typeof Spacing;

export const Radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 28,
  full: 9999,
} as const;

export type RadiiToken = keyof typeof Radii;

export const Typography = {
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  heading: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  bodyStrong: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
    letterSpacing: 0.1,
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
  },
  button: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
  },
} as const;

export type TypographyToken = keyof typeof Typography;

export const TouchTarget = {
  min: 48,
} as const;

/** Cross-platform elevation (boxShadow for web, shadow* + elevation for native). */
export const Shadows = {
  soft: {
    shadowColor: '#2A1F24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    // RN Web
    boxShadow: '0px 4px 12px rgba(42, 31, 36, 0.08)',
  },
  medium: {
    shadowColor: '#2A1F24',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
    boxShadow: '0px 8px 20px rgba(42, 31, 36, 0.12)',
  },
} as const;
