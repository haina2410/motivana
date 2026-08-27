export const fontFamilies = [
  'CormorantGaramond',
  'BeVietnamPro',
  'DancingScript',
  'Lora',
] as const;
export const fontWeights = ['Light', 'Regular', 'Medium', 'SemiBold'] as const;
export const textAlignments = ['left', 'center', 'right'] as const;

export type FontFamily = (typeof fontFamilies)[number];
export type FontWeight = (typeof fontWeights)[number];
export type TextAlign = (typeof textAlignments)[number];

export interface SolidBackground {
  kind: 'solid';
  color: string;
}

export interface LinearGradientBackground {
  kind: 'linear-gradient';
  startColor: string;
  endColor: string;
  angleDegrees: number;
}

export interface ImageBackground {
  kind: 'image';
  /** Path under assets/images/, e.g. `backgrounds/mountain-01.webp`. */
  asset: string;
  /** Colour of the scrim drawn between the photograph and the quote. */
  scrimColor: string;
  /** Peak scrim opacity at the quote band, 0 to 1. */
  scrimOpacity: number;
  /**
   * Measured luminance of the quote band once the scrim is applied, 0 to 1.
   * Contrast is checked against this rather than against the photograph,
   * which has no single colour to test.
   */
  effectiveLuminance: number;
}

export type WallpaperBackground =
  SolidBackground | LinearGradientBackground | ImageBackground;

export interface WallpaperPreset {
  id: string;
  /**
   * Groups photographic backgrounds in the picker. Absent on the eight curated
   * presets, which are their own group.
   */
  category?: string;
  fontFamily: FontFamily;
  fontWeight: FontWeight;
  textAlign: TextAlign;
  quotePositionY: number;
  textColor: string;
  authorColor: string;
  preferredFontSizeRatio: number;
  minimumFontSizeRatio: number;
  lineHeight: number;
  overlay?: string;
  background: WallpaperBackground;
}

export const fontAssetPaths = {
  'CormorantGaramond-Light': 'assets/fonts/CormorantGaramond-Light.ttf',
  'CormorantGaramond-Regular': 'assets/fonts/CormorantGaramond-Regular.ttf',
  'BeVietnamPro-Light': 'assets/fonts/BeVietnamPro-Light.ttf',
  'DancingScript-Medium': 'assets/fonts/DancingScript-Medium.ttf',
  'Lora-Regular': 'assets/fonts/Lora-Regular.ttf',
  'Lora-SemiBold': 'assets/fonts/Lora-SemiBold.ttf',
} as const;

type FontAssetKey = keyof typeof fontAssetPaths;

export class WallpaperPresetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WallpaperPresetValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new WallpaperPresetValidationError(
      `${path} must be a non-empty string`,
    );
  }
  return value;
}

function requireNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new WallpaperPresetValidationError(`${path} must be a finite number`);
  }
  return value;
}

function isHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

function channelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: string): number {
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return (
    0.2126 * channelToLinear(red) +
    0.7152 * channelToLinear(green) +
    0.0722 * channelToLinear(blue)
  );
}

function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [
    relativeLuminance(first),
    relativeLuminance(second),
  ].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

function requireColor(value: unknown, path: string): string {
  const color = requireString(value, path);
  if (!isHexColor(color)) {
    throw new WallpaperPresetValidationError(`${path} must be a #RRGGBB color`);
  }
  return color;
}

function parseBackground(value: unknown, path: string): WallpaperBackground {
  if (!isRecord(value)) {
    throw new WallpaperPresetValidationError(`${path} must be an object`);
  }
  if (value.kind === 'solid') {
    return Object.freeze({
      kind: 'solid',
      color: requireColor(value.color, `${path}.color`),
    });
  }
  if (value.kind === 'linear-gradient') {
    const angleDegrees = requireNumber(
      value.angleDegrees,
      `${path}.angleDegrees`,
    );
    if (angleDegrees < 0 || angleDegrees > 360) {
      throw new WallpaperPresetValidationError(
        `${path}.angleDegrees must be between 0 and 360`,
      );
    }
    return Object.freeze({
      kind: 'linear-gradient',
      startColor: requireColor(value.startColor, `${path}.startColor`),
      endColor: requireColor(value.endColor, `${path}.endColor`),
      angleDegrees,
    });
  }
  if (value.kind === 'image') {
    const asset = requireString(value.asset, `${path}.asset`);
    if (!/^backgrounds\/[A-Za-z0-9-]+\.webp$/.test(asset)) {
      throw new WallpaperPresetValidationError(
        `${path}.asset must be a backgrounds/<id>.webp path`,
      );
    }
    const scrimOpacity = requireNumber(
      value.scrimOpacity,
      `${path}.scrimOpacity`,
    );
    if (scrimOpacity < 0 || scrimOpacity > 1) {
      throw new WallpaperPresetValidationError(
        `${path}.scrimOpacity must be between 0 and 1`,
      );
    }
    const effectiveLuminance = requireNumber(
      value.effectiveLuminance,
      `${path}.effectiveLuminance`,
    );
    if (effectiveLuminance < 0 || effectiveLuminance > 1) {
      throw new WallpaperPresetValidationError(
        `${path}.effectiveLuminance must be between 0 and 1`,
      );
    }
    return Object.freeze({
      kind: 'image',
      asset,
      scrimColor: requireColor(value.scrimColor, `${path}.scrimColor`),
      scrimOpacity,
      effectiveLuminance,
    });
  }
  throw new WallpaperPresetValidationError(
    `${path}.kind must be solid, linear-gradient or image`,
  );
}

function luminanceToGrey(luminance: number): string {
  const channel = Math.round(Math.min(1, Math.max(0, luminance)) * 255);
  return `#${channel.toString(16).padStart(2, '0').repeat(3)}`;
}

function validateTextContrast(
  textColor: string,
  background: WallpaperBackground,
  path: string,
): void {
  let colors: readonly string[];
  if (background.kind === 'solid') {
    colors = [background.color];
  } else if (background.kind === 'linear-gradient') {
    colors = [background.startColor, background.endColor];
  } else {
    colors = [luminanceToGrey(background.effectiveLuminance)];
  }
  if (
    colors.some(
      (backgroundColor) => contrastRatio(textColor, backgroundColor) < 4.5,
    )
  ) {
    throw new WallpaperPresetValidationError(
      `${path} must meet WCAG AA contrast`,
    );
  }
}

/**
 * A single colour that stands in for a background wherever one is needed but a
 * full render is not: the preset chip, the deck layers behind the card, and the
 * fill drawn under a photograph that has not loaded. For an image this is the
 * measured luminance of the quote band, so the stand-in matches what the
 * photograph looks like where it matters.
 */
export function backgroundSwatch(
  background: WallpaperBackground,
  edge: 'start' | 'end' = 'start',
): string {
  if (background.kind === 'solid') {
    return background.color;
  }
  if (background.kind === 'linear-gradient') {
    return edge === 'start' ? background.startColor : background.endColor;
  }
  return luminanceToGrey(background.effectiveLuminance);
}

export function getFontAssetPath(
  fontFamily: FontFamily,
  fontWeight: FontWeight,
): string | undefined {
  return fontAssetPaths[`${fontFamily}-${fontWeight}` as FontAssetKey];
}

export function parseWallpaperPresetCatalog(
  value: unknown,
): readonly WallpaperPreset[] {
  if (!Array.isArray(value)) {
    throw new WallpaperPresetValidationError('presets must be an array');
  }

  const ids = new Set<string>();
  const presets = value.map((entry, index): WallpaperPreset => {
    const path = `presets[${index}]`;
    if (!isRecord(entry)) {
      throw new WallpaperPresetValidationError(`${path} must be an object`);
    }
    const id = requireString(entry.id, `${path}.id`);
    if (ids.has(id)) {
      throw new WallpaperPresetValidationError(`${path}.id must be unique`);
    }
    ids.add(id);
    const fontFamily = requireString(entry.fontFamily, `${path}.fontFamily`);
    const fontWeight = requireString(entry.fontWeight, `${path}.fontWeight`);
    if (
      !fontFamilies.includes(fontFamily as FontFamily) ||
      !fontWeights.includes(fontWeight as FontWeight) ||
      !getFontAssetPath(fontFamily as FontFamily, fontWeight as FontWeight)
    ) {
      throw new WallpaperPresetValidationError(
        `${path}.fontFamily/fontWeight must name a bundled font`,
      );
    }
    const textAlign = requireString(entry.textAlign, `${path}.textAlign`);
    if (!textAlignments.includes(textAlign as TextAlign)) {
      throw new WallpaperPresetValidationError(
        `${path}.textAlign is not supported`,
      );
    }
    const quotePositionY = requireNumber(
      entry.quotePositionY,
      `${path}.quotePositionY`,
    );
    if (quotePositionY <= 0 || quotePositionY >= 1) {
      throw new WallpaperPresetValidationError(
        `${path}.quotePositionY must be between 0 and 1`,
      );
    }
    const preferredFontSizeRatio = requireNumber(
      entry.preferredFontSizeRatio,
      `${path}.preferredFontSizeRatio`,
    );
    const minimumFontSizeRatio = requireNumber(
      entry.minimumFontSizeRatio,
      `${path}.minimumFontSizeRatio`,
    );
    if (
      minimumFontSizeRatio <= 0 ||
      minimumFontSizeRatio > preferredFontSizeRatio
    ) {
      throw new WallpaperPresetValidationError(
        `${path}.minimumFontSizeRatio must be positive and no greater than preferredFontSizeRatio`,
      );
    }
    if (preferredFontSizeRatio > 0.2) {
      throw new WallpaperPresetValidationError(
        `${path}.preferredFontSizeRatio must not exceed 0.2`,
      );
    }
    const lineHeight = requireNumber(entry.lineHeight, `${path}.lineHeight`);
    if (lineHeight < 1 || lineHeight > 2) {
      throw new WallpaperPresetValidationError(
        `${path}.lineHeight must be between 1 and 2`,
      );
    }
    const background = parseBackground(entry.background, `${path}.background`);
    const textColor = requireColor(entry.textColor, `${path}.textColor`);
    validateTextContrast(textColor, background, `${path}.textColor`);

    return Object.freeze({
      id,
      ...(entry.category === undefined
        ? {}
        : { category: requireString(entry.category, `${path}.category`) }),
      fontFamily: fontFamily as FontFamily,
      fontWeight: fontWeight as FontWeight,
      textAlign: textAlign as TextAlign,
      quotePositionY,
      textColor,
      authorColor: requireColor(entry.authorColor, `${path}.authorColor`),
      preferredFontSizeRatio,
      minimumFontSizeRatio,
      lineHeight,
      ...(entry.overlay === undefined
        ? {}
        : { overlay: requireColor(entry.overlay, `${path}.overlay`) }),
      background,
    });
  });

  return Object.freeze(presets);
}
