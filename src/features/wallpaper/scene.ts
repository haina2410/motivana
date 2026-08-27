import {
  Skia,
  TextAlign,
  TileMode,
  type SkCanvas,
  type SkImage,
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
import { backgroundSwatch } from './types';
import { favoriteQuoteText } from '../quotes/quoteRepository';

function skiaFontWeight(
  weight: WallpaperComposition['preset']['fontWeight'],
): number {
  'worklet';
  if (weight === 'Light') return 300;
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

/** `#RRGGBB` plus an alpha, as a colour string both Skia and the tests accept. */
function withAlpha(hex: string, alpha: number): string {
  'worklet';
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

/**
 * The source rectangle that fills the canvas without distorting the
 * photograph. Backgrounds are cut to the canvas aspect ratio already, so this
 * normally takes the whole frame; it matters on a preview card whose aspect
 * ratio differs from the phone's.
 */
function coverSource(
  imageWidth: number,
  imageHeight: number,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  'worklet';
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  return {
    x: (imageWidth - sourceWidth) / 2,
    y: (imageHeight - sourceHeight) / 2,
    width: sourceWidth,
    height: sourceHeight,
  };
}

/** How far above and below the quote the scrim fades out, as a fraction. */
const SCRIM_SPREAD = 0.42;

export function drawWallpaperScene(
  target: unknown,
  composition: WallpaperComposition,
  fontProvider?: SkTypefaceFontProvider,
  backgroundImage?: SkImage,
): void {
  'worklet';
  const canvas = target as SkCanvas;
  const backgroundPaint = Skia.Paint();
  const markPaint = Skia.Paint();
  let shader: ReturnType<typeof Skia.Shader.MakeLinearGradient> | undefined;
  let scrimShader:
    ReturnType<typeof Skia.Shader.MakeLinearGradient> | undefined;
  let quote: ReturnType<typeof createParagraph> | undefined;
  let author: ReturnType<typeof createParagraph> | undefined;

  try {
    if (composition.preset.background.kind !== 'linear-gradient') {
      // Solid, or a photograph standing in as its measured band colour until
      // the decoded image is handed to the scene.
      backgroundPaint.setColor(
        Skia.Color(backgroundSwatch(composition.preset.background)),
      );
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

    const background = composition.preset.background;
    if (background.kind === 'image' && backgroundImage) {
      // The fill above stays underneath as the backdrop, so a canvas whose
      // aspect ratio the photograph cannot cover has no bare edge.
      const source = coverSource(
        backgroundImage.width(),
        backgroundImage.height(),
        composition.width,
        composition.height,
      );
      const imagePaint = Skia.Paint();
      try {
        canvas.drawImageRect(
          backgroundImage,
          Skia.XYWHRect(source.x, source.y, source.width, source.height),
          Skia.XYWHRect(0, 0, composition.width, composition.height),
          imagePaint,
        );
      } finally {
        imagePaint.dispose?.();
      }

      // A scrim that peaks on the quote and fades out well before either
      // edge. A flat wash over the whole frame would flatten the photograph;
      // the quote only needs contrast where it actually sits.
      const centre = composition.preset.quotePositionY;
      const top = Math.max(0, centre - SCRIM_SPREAD);
      const bottom = Math.min(1, centre + SCRIM_SPREAD);
      const scrimPaint = Skia.Paint();
      try {
        scrimShader = Skia.Shader.MakeLinearGradient(
          Skia.Point(0, 0),
          Skia.Point(0, composition.height),
          [
            Skia.Color(withAlpha(background.scrimColor, 0)),
            Skia.Color(withAlpha(background.scrimColor, 0)),
            Skia.Color(
              withAlpha(background.scrimColor, background.scrimOpacity),
            ),
            Skia.Color(withAlpha(background.scrimColor, 0)),
            Skia.Color(withAlpha(background.scrimColor, 0)),
          ],
          [0, top, centre, bottom, 1],
          TileMode.Clamp,
        );
        scrimPaint.setShader(scrimShader);
        canvas.drawRect(
          Skia.XYWHRect(0, 0, composition.width, composition.height),
          scrimPaint,
        );
      } finally {
        scrimPaint.dispose?.();
      }
    }

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
      favoriteQuoteText(composition.quote, composition.locale),
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
    scrimShader?.dispose?.();
    shader?.dispose?.();
    markPaint.dispose?.();
    backgroundPaint.dispose?.();
  }
}
