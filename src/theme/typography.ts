import { colors } from './colors';

/**
 * Android resolves a weight from the family name, not from `fontWeight`, so
 * every chrome style names the exact Be Vietnam Pro face it wants. Be Vietnam
 * Pro is drawn for Vietnamese first, which is why the board picked it for the
 * chrome as well as for the plainer wallpaper presets.
 */
export const fonts = {
  light: 'BeVietnamPro-Light',
  regular: 'BeVietnamPro-Regular',
  medium: 'BeVietnamPro-Medium',
  semibold: 'BeVietnamPro-SemiBold',
} as const;

export const typography = {
  /** Small caps-style label above a screen title. */
  eyebrow: {
    color: colors.dimText,
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
  },
  /** Section heading inside a screen: "Typeface", "Source", "Export". */
  sectionLabel: {
    color: colors.faintText,
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase' as const,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 26,
    letterSpacing: -0.3,
  },
  screenTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 23,
    letterSpacing: -0.2,
  },
  body: {
    color: colors.mutedText,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  caption: {
    color: colors.dimText,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  /** Row labels in the settings and rotation lists. */
  rowLabel: { color: colors.text, fontFamily: fonts.regular, fontSize: 15 },
  rowValue: { color: colors.dimText, fontFamily: fonts.regular, fontSize: 13 },
  button: { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  primaryButton: {
    color: colors.onAccent,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  chip: { color: colors.text, fontFamily: fonts.medium, fontSize: 12 },
  tab: { fontFamily: fonts.medium, fontSize: 10 },
} as const;
