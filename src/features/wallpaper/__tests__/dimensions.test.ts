import { fitPreviewBox, wallpaperPixelDimensions } from '../dimensions';

test('uses physical pixel dimensions so Android exports meet the full-resolution minimum', () => {
  expect(wallpaperPixelDimensions(432, 960, 2.5)).toEqual({
    width: 1080,
    height: 2400,
  });
});

test('does not allow an invalid pixel ratio to corrupt the composition dimensions', () => {
  expect(wallpaperPixelDimensions(432, 960, Number.NaN)).toEqual({
    width: 432,
    height: 960,
  });
});

// Mutation caught: fitting only by width would squeeze a tall wallpaper into a short preview area.
test('fits a portrait wallpaper inside a short preview area without squeezing', () => {
  const box = fitPreviewBox({ width: 360, height: 400 }, 1080 / 2400);

  expect(box.width).toBeCloseTo(180);
  expect(box.height).toBeCloseTo(400);
  expect(box.width / box.height).toBeCloseTo(1080 / 2400);
});

test('fits by width when the preview area is taller than the wallpaper ratio', () => {
  const box = fitPreviewBox({ width: 360, height: 1200 }, 1080 / 2400);

  expect(box.width).toBeCloseTo(360);
  expect(box.height).toBeCloseTo(800);
});

test('returns the area unchanged for an unusable ratio', () => {
  expect(fitPreviewBox({ width: 360, height: 400 }, 0)).toEqual({
    width: 360,
    height: 400,
  });
});
