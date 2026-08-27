import { GRID_GAP, MIN_CARD_WIDTH, gridColumns } from '../gridColumns';

// Mutation caught: keeping the old two-column grid would show a third of the
// wallpapers per screen on an ordinary phone.
test('an ordinary phone shows three across', () => {
  // 390pt screen, less 18pt padding each side.
  expect(gridColumns(390 - 36)).toBe(3);
  // A large phone is still three, at a wider card.
  expect(gridColumns(430 - 36)).toBe(3);
});

// Mutation caught: a fixed column count would leave a tablet showing three
// cards stretched across the whole screen.
test('a wider screen earns more columns', () => {
  expect(gridColumns(834 - 36)).toBe(6);
  expect(gridColumns(1024 - 36)).toBe(8);
});

// Mutation caught: dropping the floor would shrink cards below the width that
// keeps a quote readable on a small phone.
test('three is a floor, never fewer', () => {
  expect(gridColumns(320 - 36)).toBe(3);
  expect(gridColumns(200)).toBe(3);
  expect(gridColumns(0)).toBe(3);
  expect(gridColumns(Number.NaN)).toBe(3);
});

// Mutation caught: ignoring the gap would fit one column too many and overflow
// the row.
test('the gap between cards counts against the available width', () => {
  const columns = gridColumns(400, MIN_CARD_WIDTH, GRID_GAP);
  const used = columns * MIN_CARD_WIDTH + (columns - 1) * GRID_GAP;
  expect(used).toBeLessThanOrEqual(400);
});
