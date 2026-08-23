export function wallpaperPixelDimensions(
  width: number,
  height: number,
  pixelRatio: number,
): { width: number; height: number } {
  const scale = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
