/**
 * How a device-sized composition is placed inside the box that draws it.
 *
 * `contain` letterboxes: the whole wallpaper is visible and a box of a
 * different aspect ratio keeps a band of its own background. The picker cards
 * want that. `cover` fills the box and lets the overflow run off both edges of
 * the long axis, which is what makes the deck full-bleed -- the composition is
 * the wallpaper artifact and stays device-sized, so only the fit changes.
 */
export type WallpaperFit = 'contain' | 'cover';

export interface WallpaperFitTransform {
  scale: number;
  /** Where the composition's own origin lands inside the box. */
  x: number;
  y: number;
}

/**
 * The single scale and origin both the canvas and the preset caption read.
 *
 * The caption is positioned in composition pixels and has to land on the quote
 * the canvas drew, so a second copy of this arithmetic anywhere would let the
 * two drift apart. That drift has already been fixed once.
 */
export function fitWallpaper(
  composition: { width: number; height: number },
  box: { width: number; height: number },
  fit: WallpaperFit = 'contain',
): WallpaperFitTransform {
  const horizontal = box.width / composition.width;
  const vertical = box.height / composition.height;
  // Anchored at the box's own top-left: a contained composition never
  // overflows, so there is nothing to centre.
  if (fit === 'contain') {
    return { scale: Math.min(horizontal, vertical), x: 0, y: 0 };
  }
  // Cover overflows the box on one axis. Without the centring offset the whole
  // overflow falls off the right and bottom edges instead of half off each.
  const scale = Math.max(horizontal, vertical);
  return {
    scale,
    x: (box.width - composition.width * scale) / 2,
    y: (box.height - composition.height * scale) / 2,
  };
}
