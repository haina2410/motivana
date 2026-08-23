import { colors } from './colors';

export const typography = {
  eyebrow: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
  },
  title: { color: colors.text, fontSize: 30, fontWeight: '700' as const },
  screenTitle: { color: colors.text, fontSize: 26, fontWeight: '700' as const },
  body: { color: colors.mutedText, fontSize: 16, lineHeight: 24 },
  button: { color: colors.text, fontSize: 15, fontWeight: '700' as const },
} as const;
