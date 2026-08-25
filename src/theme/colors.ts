/**
 * Ink chrome from the redesign board: the application recedes to near-black so
 * the wallpaper is the only bright thing on screen, and a single warm amber
 * carries every affirmative action.
 */
export const colors = {
  background: '#0E0F13',
  bezel: '#08090C',
  surface: '#16171C',
  surfaceRaised: '#1E2027',
  // Translucent fills, layered over the ink background rather than replacing it.
  fill: 'rgba(255, 255, 255, 0.09)',
  fillSubtle: 'rgba(255, 255, 255, 0.04)',
  fillFaint: 'rgba(255, 255, 255, 0.03)',
  border: 'rgba(255, 255, 255, 0.16)',
  borderStrong: 'rgba(255, 255, 255, 0.2)',
  borderSubtle: 'rgba(255, 255, 255, 0.08)',
  text: '#FFFFFF',
  mutedText: 'rgba(255, 255, 255, 0.62)',
  dimText: 'rgba(255, 255, 255, 0.42)',
  faintText: 'rgba(255, 255, 255, 0.32)',
  accent: '#E8B44C',
  onAccent: '#141005',
  accentWash: 'rgba(232, 180, 76, 0.1)',
  accentBorder: 'rgba(232, 180, 76, 0.26)',
  success: '#7BC98F',
  danger: '#F3A6A0',
  overlay: 'rgba(8, 9, 12, 0.62)',
  disabled: '#6E7076',
} as const;
