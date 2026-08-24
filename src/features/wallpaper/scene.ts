import {
  Skia,
  TextAlign,
  TileMode,
  type SkCanvas,
  type SkParagraph,
  type SkParagraphBuilder,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';

import {
  createComposition,
  type TextMeasurer,
  type WallpaperComposition,
} from './composition';
import { gradientEndpoints } from './gradient';

function skiaFontWeight(
  weight: WallpaperComposition['preset']['fontWeight'],
): number {
  'worklet';
  if (weight === 'Medium') return 500;
  if (weight === 'SemiBold') return 600;
  return 400;
}

function paragraphAlignment(
  alignment: WallpaperComposition['preset']['textAlign'],
): TextAlign {
  'worklet';
  if (alignment === 'center') return TextAlign.Center;
  if (alignment === 'right') return TextAlign.Right;
  return TextAlign.Left;
}

function createParagraph(
  text: string,
  composition: WallpaperComposition,
  fontSize: number,
  color: string,
  maxLines: number | undefined,
  ellipsis: string | undefined,
  fontProvider?: SkTypefaceFontProvider,
  width = composition.quoteBounds.width,
): { builder: SkParagraphBuilder; paragraph: SkParagraph } {
  'worklet';
  const builder = Skia.ParagraphBuilder.Make(
    {
      textAlign: paragraphAlignment(composition.preset.textAlign),
      heightMultiplier: composition.preset.lineHeight,
      ...(maxLines === undefined ? {} : { maxLines }),
      ...(ellipsis === undefined ? {} : { ellipsis }),
      textStyle: {
        color: Skia.Color(color),
        fontFamilies: [composition.preset.fontFamily],
        fontSize,
        fontStyle: { weight: skiaFontWeight(composition.preset.fontWeight) },
      },
    },
    fontProvider,
  );
  builder.addText(text);
  const paragraph = builder.build();
  paragraph.layout(width);
  return { builder, paragraph };
}

/** Uses the same Skia paragraph engine that paints preview and export text. */
export function createSkiaTextMeasurer(
  composition: WallpaperComposition,
  fontProvider: SkTypefaceFontProvider,
): TextMeasurer {
  return {
    measure: (text, width, fontSize) => {
      const measured = createParagraph(
        text,
        composition,
        fontSize,
        composition.preset.textColor,
        undefined,
        undefined,
        fontProvider,
        width,
      );
      try {
        return {
          height: measured.paragraph.getHeight(),
          lineCount: Math.max(1, measured.paragraph.getLineMetrics().length),
        };
      } finally {
        measured.paragraph.dispose?.();
        measured.builder.dispose?.();
      }
    },
    measureWithMaxLines: (text, width, fontSize, _lineHeight, maxLines) => {
      const measured = createParagraph(
        text,
        composition,
        fontSize,
        composition.preset.textColor,
        maxLines,
        '…',
        fontProvider,
        width,
      );
      try {
        return {
          height: measured.paragraph.getHeight(),
          lineCount: Math.max(1, measured.paragraph.getLineMetrics().length),
        };
      } finally {
        measured.paragraph.dispose?.();
        measured.builder.dispose?.();
      }
    },
  };
}

export function measureSkiaComposition(
  composition: WallpaperComposition,
  fontProvider: SkTypefaceFontProvider,
): WallpaperComposition {
  return createComposition(
    composition,
    createSkiaTextMeasurer(composition, fontProvider),
  );
}

export function drawWallpaperScene(
  target: unknown,
  composition: WallpaperComposition,
  fontProvider?: SkTypefaceFontProvider,
): void {
  'worklet';
  const canvas = target as SkCanvas;
  const backgroundPaint = Skia.Paint();
  const markPaint = Skia.Paint();
  let shader: ReturnType<typeof Skia.Shader.MakeLinearGradient> | undefined;
  let quote: ReturnType<typeof createParagraph> | undefined;
  let author: ReturnType<typeof createParagraph> | undefined;

  try {
    if (composition.preset.background.kind === 'solid') {
      backgroundPaint.setColor(Skia.Color(composition.preset.background.color));
    } else {
      const endpoints = gradientEndpoints(
        composition.preset.background.angleDegrees,
        composition.width,
        composition.height,
      );
      shader = Skia.Shader.MakeLinearGradient(
        Skia.Point(endpoints.start.x, endpoints.start.y),
        Skia.Point(endpoints.end.x, endpoints.end.y),
        [
          Skia.Color(composition.preset.background.startColor),
          Skia.Color(composition.preset.background.endColor),
        ],
        null,
        TileMode.Clamp,
      );
      backgroundPaint.setShader(shader);
    }
    canvas.drawRect(
      Skia.XYWHRect(0, 0, composition.width, composition.height),
      backgroundPaint,
    );

    if (composition.preset.overlay) {
      const overlayPaint = Skia.Paint();
      try {
        overlayPaint.setColor(Skia.Color(composition.preset.overlay));
        canvas.drawRect(
          Skia.XYWHRect(0, 0, composition.width, composition.height),
          overlayPaint,
        );
      } finally {
        overlayPaint.dispose();
      }
    }

    markPaint.setColor(Skia.Color(composition.preset.authorColor));
    markPaint.setAlphaf(0.35);
    const markSize = composition.quoteFontSize * 1.5;
    const markX =
      composition.preset.textAlign === 'right'
        ? composition.quoteBounds.x + composition.quoteBounds.width - markSize
        : composition.quoteBounds.x;
    canvas.drawCircle(
      markX + markSize / 2,
      composition.quoteBounds.y - markSize / 3,
      markSize / 10,
      markPaint,
    );

    quote = createParagraph(
      composition.quote.text,
      composition,
      composition.quoteFontSize,
      composition.preset.textColor,
      composition.truncated ? composition.maxQuoteLines : undefined,
      composition.truncated ? '…' : undefined,
      fontProvider,
    );
    quote.paragraph.paint(
      canvas,
      composition.quoteBounds.x,
      composition.quoteBounds.y,
    );

    if (composition.quote.author) {
      author = createParagraph(
        `— ${composition.quote.author}`,
        composition,
        composition.authorFontSize,
        composition.preset.authorColor,
        1,
        undefined,
        fontProvider,
      );
      author.paragraph.paint(
        canvas,
        composition.quoteBounds.x,
        composition.authorY,
      );
    }
  } finally {
    author?.paragraph.dispose?.();
    author?.builder.dispose?.();
    quote?.paragraph.dispose?.();
    quote?.builder.dispose?.();
    shader?.dispose?.();
    markPaint.dispose?.();
    backgroundPaint.dispose?.();
  }
}
