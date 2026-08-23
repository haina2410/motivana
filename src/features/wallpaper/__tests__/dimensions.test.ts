import { wallpaperPixelDimensions } from '../dimensions';

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
