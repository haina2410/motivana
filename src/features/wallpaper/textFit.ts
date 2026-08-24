export interface TextMeasurer {
  measure(
    text: string,
    width: number,
    fontSize: number,
    lineHeight: number,
  ): { height: number; lineCount: number };
  /** Measures the paragraph after the renderer applies an explicit ellipsis cap. */
  measureWithMaxLines?(
    text: string,
    width: number,
    fontSize: number,
    lineHeight: number,
    maxLines: number,
  ): { height: number; lineCount: number };
}

export interface FitTextOptions {
  text?: string;
  width?: number;
  preferredSize: number;
  minimumSize: number;
  maxHeight: number;
  lineHeight: number;
  measure: TextMeasurer;
}

export interface FittedText {
  fontSize: number;
  measuredHeight: number;
  truncated: boolean;
  maxLines: number;
}

function integerPixel(value: number): number {
  return Math.round(value);
}

export function fitText(options: FitTextOptions): FittedText {
  const preferredSize = integerPixel(options.preferredSize);
  const minimumSize = integerPixel(options.minimumSize);
  if (
    !Number.isFinite(options.maxHeight) ||
    options.maxHeight <= 0 ||
    !Number.isFinite(options.lineHeight) ||
    options.lineHeight <= 0 ||
    minimumSize <= 0 ||
    preferredSize < minimumSize
  ) {
    throw new Error('Text fitting requires positive, ordered dimensions.');
  }

  for (let fontSize = preferredSize; fontSize >= minimumSize; fontSize -= 1) {
    const lineHeight = fontSize * options.lineHeight;
    const measurement = options.measure.measure(
      options.text ?? '',
      options.width ?? Number.MAX_SAFE_INTEGER,
      fontSize,
      lineHeight,
    );
    if (measurement.height <= options.maxHeight) {
      return {
        fontSize,
        measuredHeight: measurement.height,
        truncated: false,
        maxLines: Math.max(1, measurement.lineCount),
      };
    }
  }

  const lineHeight = minimumSize * options.lineHeight;
  let maxLines = Math.max(1, Math.floor(options.maxHeight / lineHeight));
  let measuredHeight = options.maxHeight;
  if (options.measure.measureWithMaxLines) {
    const text = options.text ?? '';
    const width = options.width ?? Number.MAX_SAFE_INTEGER;
    let constrained = options.measure.measureWithMaxLines(
      text,
      width,
      minimumSize,
      lineHeight,
      maxLines,
    );
    while (maxLines > 1 && constrained.height > options.maxHeight) {
      maxLines -= 1;
      constrained = options.measure.measureWithMaxLines(
        text,
        width,
        minimumSize,
        lineHeight,
        maxLines,
      );
    }
    measuredHeight = Math.min(options.maxHeight, constrained.height);
  }
  return {
    fontSize: minimumSize,
    measuredHeight,
    truncated: true,
    maxLines,
  };
}
