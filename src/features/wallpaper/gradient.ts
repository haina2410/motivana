export interface GradientEndpoints {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

/**
 * Maps a clockwise screen-space angle to a gradient axis through the canvas
 * centre.  Zero degrees points left-to-right and 90 degrees points top-to-
 * bottom because screen Y increases downwards.  The axis spans the canvas
 * diagonal so clamp mode covers every pixel.  This is mirrored by Android's
 * CanvasWallpaperRenderer.gradientCoordinates.
 */
export function gradientEndpoints(
  angleDegrees: number,
  width: number,
  height: number,
): GradientEndpoints {
  const radians = (angleDegrees * Math.PI) / 180;
  const radius = Math.hypot(width, height) / 2;
  const deltaX = Math.cos(radians) * radius;
  const deltaY = Math.sin(radians) * radius;
  const centerX = width / 2;
  const centerY = height / 2;

  return {
    start: { x: centerX - deltaX, y: centerY - deltaY },
    end: { x: centerX + deltaX, y: centerY + deltaY },
  };
}
