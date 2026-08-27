import { colors } from '../../theme/colors';
import { backgroundSwatch, type WallpaperPreset } from './types';

/**
 * The layers behind the live card, near to far: how far each fades into the ink
 * background, and how far it moves right and down.
 */
const layerSpecs = [
  { fade: 0.5, shift: 13, opacity: 1 },
  { fade: 0.74, shift: 26, opacity: 0.8 },
] as const;

/** How far the drawn layers reach past the live card, right and down. */
export const deckLayerReach = Math.max(...layerSpecs.map((spec) => spec.shift));

export interface DeckLayer {
  /** The fill, taken from the preset and faded toward the ink background. */
  color: string;
  /** Points the layer moves right and down, so the stack reads as a deck. */
  shift: number;
  opacity: number;
}

/**
 * The look of the wallpapers waiting behind the live card. They carry the
 * preset's own colour, so the stack reads as one set of wallpapers rather than
 * as grey placeholders, but they are drawn, not rendered.
 */
export function deckLayers(preset: WallpaperPreset | undefined): DeckLayer[] {
  const source =
    preset === undefined
      ? colors.surfaceRaised
      : backgroundSwatch(preset.background, 'end');
  return layerSpecs.map((spec) => ({
    color: fadeToBackground(source, spec.fade),
    shift: spec.shift,
    opacity: spec.opacity,
  }));
}

/** Mixes a colour toward the application background. */
export function fadeToBackground(hex: string, amount: number): string {
  const from = parseHex(hex);
  const to = parseHex(colors.background);
  if (!from || !to) return colors.surfaceRaised;
  const weight = Math.min(1, Math.max(0, amount));
  const channels = from.map((value, index) =>
    Math.round(value + ((to[index] ?? value) - value) * weight),
  );
  return `#${channels.map(toHexPair).join('')}`;
}

function parseHex(hex: string): number[] | undefined {
  const digits = hex.replace('#', '');
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : digits;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return undefined;
  return [0, 2, 4].map((start) => parseInt(full.slice(start, start + 2), 16));
}

function toHexPair(value: number): string {
  return Math.min(255, Math.max(0, value)).toString(16).padStart(2, '0');
}
