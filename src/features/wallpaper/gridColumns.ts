/**
 * How many wallpaper cards fit across the picker.
 *
 * Three on an ordinary phone, more as the screen grows, so a tablet does not
 * show three enormous cards. The card never goes below MIN_CARD_WIDTH, which
 * is what keeps the quote inside a thumbnail legible.
 */
export const MIN_CARD_WIDTH = 110;
export const GRID_GAP = 12;
const MIN_COLUMNS = 3;

export function gridColumns(
  availableWidth: number,
  minCardWidth = MIN_CARD_WIDTH,
  gap = GRID_GAP,
): number {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) {
    return MIN_COLUMNS;
  }
  const fits = Math.floor((availableWidth + gap) / (minCardWidth + gap));
  return Math.max(MIN_COLUMNS, fits);
}
