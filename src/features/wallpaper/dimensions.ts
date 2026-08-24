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

/** Returns the largest box with the wallpaper ratio that fits the area. */
export function fitPreviewBox(
  area: { width: number; height: number },
  ratio: number,
): { width: number; height: number } {
  if (!Number.isFinite(ratio) || ratio <= 0) return area;
  const width = Math.min(area.width, area.height * ratio);
  return { width: Math.max(1, width), height: Math.max(1, width / ratio) };
}
