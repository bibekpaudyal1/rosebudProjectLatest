import { StyleSheet, Platform } from 'react-native';

export const COLORS = {
  green:       '#0A6E4F',
  greenLight:  '#0E9267',
  greenPale:   '#E6F4F0',
  orange:      '#F57C00',
  orangePale:  '#FFF3E0',
  red:         '#D32F2F',
  gold:        '#FFB300',

  gray900:     '#1A1A2E',
  gray700:     '#374151',
  gray600:     '#4B5563',
  gray500:     '#6B7280',
  gray400:     '#9CA3AF',
  gray300:     '#D1D5DB',
  gray200:     '#E5E7EB',
  gray100:     '#F3F4F6',
  gray50:      '#F9FAFB',

  white:       '#FFFFFF',
  black:       '#000000',
} as const;

export const FONTS = {
  regular:    'PlusJakartaSans_400Regular',
  medium:     'PlusJakartaSans_500Medium',
  semibold:   'PlusJakartaSans_600SemiBold',
  bold:       'PlusJakartaSans_700Bold',
  extrabold:  'PlusJakartaSans_800ExtraBold',
} as const;

export const SPACING = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  xxxl:32,
} as const;

export const RADIUS = {
  sm:   6,
  md:   10,
  lg:   16,
  xl:   24,
  full: 9999,
} as const;

export const SHADOW = {
  sm: Platform.select({
    ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
    android: { elevation: 2 },
    default: {},
  })!,
  md: Platform.select({
    ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.10, shadowRadius: 8, elevation: 4 },
    android: { elevation: 4 },
    default: {},
  })!,
  lg: Platform.select({
    ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
    android: { elevation: 8 },
    default: {},
  })!,
} as const;

// Shared component styles
export const shared = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius:    RADIUS.lg,
    ...SHADOW.sm,
    borderWidth:     0.5,
    borderColor:     COLORS.gray200,
  },
  row: {
    flexDirection:  'row',
    alignItems:     'center',
  },
  center: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  flex1: { flex: 1 },
  screen: {
    flex:            1,
    backgroundColor: COLORS.gray50,
  },
  container: {
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    fontSize:   20,
    fontFamily: FONTS.extrabold,
    color:      COLORS.gray900,
    marginBottom: SPACING.md,
  },
});
