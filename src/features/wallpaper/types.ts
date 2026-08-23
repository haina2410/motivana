export const fontFamilies = ['Inter', 'Lora', 'Oswald'] as const;
export const fontWeights = ['Regular', 'SemiBold', 'Medium'] as const;
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

export type WallpaperBackground = SolidBackground | LinearGradientBackground;

export interface WallpaperPreset {
  id: string;
  name: string;
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
  'Inter-Regular': 'assets/fonts/Inter-Regular.ttf',
  'Inter-SemiBold': 'assets/fonts/Inter-SemiBold.ttf',
  'Lora-Regular': 'assets/fonts/Lora-Regular.ttf',
  'Lora-SemiBold': 'assets/fonts/Lora-SemiBold.ttf',
  'Oswald-Medium': 'assets/fonts/Oswald-Medium.ttf',
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
  throw new WallpaperPresetValidationError(
    `${path}.kind must be solid or linear-gradient`,
  );
}

function validateTextContrast(
  textColor: string,
  background: WallpaperBackground,
  path: string,
): void {
  const colors =
    background.kind === 'solid'
      ? [background.color]
      : [background.startColor, background.endColor];
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
      name: requireString(entry.name, `${path}.name`),
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
