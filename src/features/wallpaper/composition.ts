import { quoteText, type Quote } from '../quotes/types';
import type { WallpaperPreset } from './types';
import { fitText, type TextMeasurer } from './textFit';

export type { TextMeasurer } from './textFit';

export interface WallpaperCompositionInput {
  quote: Quote;
  preset: WallpaperPreset;
  width: number;
  height: number;
}

export interface RenderedWallpaper {
  uri: string;
  width: number;
  height: number;
}

export interface WallpaperComposition extends WallpaperCompositionInput {
  cacheKey: string;
  quoteBounds: { x: number; y: number; width: number; height: number };
  authorY: number;
  quoteFontSize: number;
  authorFontSize: number;
  maxQuoteLines: number;
  truncated: boolean;
}

const HORIZONTAL_SAFE_MARGIN_RATIO = 0.08;
const VERTICAL_SAFE_MARGIN_RATIO = 0.1;
const AUTHOR_GAP_RATIO = 0.022;
const AUTHOR_FONT_SIZE_RATIO = 0.028;
const AUTHOR_LINE_HEIGHT_RATIO = 1.2;

export const deterministicTextMeasurer: TextMeasurer = {
  measure: (text, width, fontSize, lineHeight) => {
    const charactersPerLine = Math.max(
      1,
      Math.floor(width / (fontSize * 0.52)),
    );
    const lineCount = Math.max(1, Math.ceil(text.length / charactersPerLine));
    return { height: lineCount * lineHeight, lineCount };
  },
};

/**
 * Hashes the rendered text with FNV-1a, so the cache key changes whenever the
 * text changes. Base 36 keeps the key usable as an export filename.
 */
function textFingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function validDimension(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function createComposition(
  input: WallpaperCompositionInput,
  measure: TextMeasurer = deterministicTextMeasurer,
): WallpaperComposition {
  if (!validDimension(input.width) || !validDimension(input.height)) {
    throw new Error('Wallpaper composition requires positive dimensions.');
  }

  const horizontalMargin = input.width * HORIZONTAL_SAFE_MARGIN_RATIO;
  const topSafe = input.height * VERTICAL_SAFE_MARGIN_RATIO;
  const bottomSafe = input.height * (1 - VERTICAL_SAFE_MARGIN_RATIO);
  const quoteWidth = input.width - horizontalMargin * 2;
  const authorFontSize = Math.round(input.width * AUTHOR_FONT_SIZE_RATIO);
  const authorLineHeight = input.quote.author
    ? authorFontSize * AUTHOR_LINE_HEIGHT_RATIO
    : 0;
  const authorGap = input.quote.author ? input.height * AUTHOR_GAP_RATIO : 0;
  const maxQuoteHeight = bottomSafe - topSafe - authorLineHeight - authorGap;
  const fit = fitText({
    text: quoteText(input.quote, 'en') ?? '',
    width: quoteWidth,
    preferredSize: Math.round(
      input.width * input.preset.preferredFontSizeRatio,
    ),
    minimumSize: Math.round(input.width * input.preset.minimumFontSizeRatio),
    maxHeight: maxQuoteHeight,
    lineHeight: input.preset.lineHeight,
    measure,
  });

  const desiredQuoteY =
    input.height * input.preset.quotePositionY - fit.measuredHeight / 2;
  const maximumQuoteY =
    bottomSafe - fit.measuredHeight - authorGap - authorLineHeight;
  const quoteY = clamp(desiredQuoteY, topSafe, maximumQuoteY);

  return Object.freeze({
    ...input,
    cacheKey: `${input.preset.id}-${input.quote.id}-${input.width}x${input.height}-${textFingerprint(quoteText(input.quote, 'en') ?? '')}`,
    quoteBounds: Object.freeze({
      x: horizontalMargin,
      y: quoteY,
      width: quoteWidth,
      height: fit.measuredHeight,
    }),
    authorY: quoteY + fit.measuredHeight + authorGap,
    quoteFontSize: fit.fontSize,
    authorFontSize,
    maxQuoteLines: fit.maxLines,
    truncated: fit.truncated,
  });
}
