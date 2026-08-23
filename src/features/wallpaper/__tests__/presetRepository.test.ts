import { getAllPresets, getPresetById } from '../presetRepository';
import { parseWallpaperPresetCatalog, type WallpaperPreset } from '../types';

const validPreset = {
  id: 'test-preset',
  name: 'Test preset',
  fontFamily: 'Inter',
  fontWeight: 'Regular',
  textAlign: 'center',
  quotePositionY: 0.45,
  textColor: '#FFFFFF',
  authorColor: '#FFFFFF',
  preferredFontSizeRatio: 0.064,
  minimumFontSizeRatio: 0.036,
  lineHeight: 1.2,
  background: {
    kind: 'solid',
    color: '#111827',
  },
};

test('ships eight valid and visually distinct presets', () => {
  const presets = getAllPresets();

  expect(presets).toHaveLength(8);
  expect(new Set(presets.map((preset) => preset.id))).toHaveProperty('size', 8);
  expect(
    new Set(presets.map((preset) => JSON.stringify(preset.background))),
  ).toHaveProperty('size', 8);
  expect(presets.map((preset) => preset.id)).toEqual([
    'midnight-focus',
    'sunrise-drive',
    'forest-discipline',
    'violet-growth',
    'paper-confidence',
    'ocean-success',
    'ember-action',
    'mono-clarity',
  ]);
});

test('returns a readonly preset catalog that cannot alter later reads', () => {
  const presets = getAllPresets() as WallpaperPreset[];

  expect(() => presets.pop()).toThrow();
  expect(getAllPresets()).toHaveLength(8);
});

test('looks up a preset by stable ID and handles missing IDs', () => {
  expect(getPresetById('paper-confidence')).toMatchObject({
    fontFamily: 'Oswald',
    fontWeight: 'Medium',
    textAlign: 'left',
  });
  expect(getPresetById('not-a-preset')).toBeUndefined();
});

test('rejects an unsupported font family and weight pair at catalog load', () => {
  expect(() =>
    parseWallpaperPresetCatalog([
      { ...validPreset, fontFamily: 'Oswald', fontWeight: 'Regular' },
    ]),
  ).toThrow('presets[0].fontFamily/fontWeight');
});

test('rejects font ratios where the minimum exceeds the preferred ratio', () => {
  expect(() =>
    parseWallpaperPresetCatalog([
      {
        ...validPreset,
        preferredFontSizeRatio: 0.03,
        minimumFontSizeRatio: 0.04,
      },
    ]),
  ).toThrow('presets[0].minimumFontSizeRatio');
});

test('rejects an unknown background kind at catalog load', () => {
  expect(() =>
    parseWallpaperPresetCatalog([
      { ...validPreset, background: { kind: 'radial', color: '#111827' } },
    ]),
  ).toThrow('presets[0].background.kind');
});

test('rejects quote text colors that fail WCAG AA contrast', () => {
  expect(() =>
    parseWallpaperPresetCatalog([
      {
        ...validPreset,
        textColor: '#777777',
        background: { kind: 'solid', color: '#FFFFFF' },
      },
    ]),
  ).toThrow('presets[0].textColor must meet WCAG AA contrast');
});
