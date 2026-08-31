import {
  getAllBackgrounds,
  getAllPresets,
  getAllTemplates,
  getPresetById,
} from '../presetRepository';
import { parseWallpaperPresetCatalog, type WallpaperPreset } from '../types';
import { en } from '../../i18n/strings/en';

const validPreset = {
  id: 'test-preset',
  fontFamily: 'BeVietnamPro',
  fontWeight: 'Light',
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

test('ships four valid and visually distinct presets', () => {
  const presets = getAllPresets();

  expect(presets).toHaveLength(4);
  expect(new Set(presets.map((preset) => preset.id))).toHaveProperty('size', 4);
  expect(
    new Set(presets.map((preset) => JSON.stringify(preset.background))),
  ).toHaveProperty('size', 4);
  expect(presets.map((preset) => preset.id)).toEqual([
    'sunrise-drive',
    'violet-growth',
    'paper-confidence',
    'mono-clarity',
  ]);
});

test('returns a readonly preset catalog that cannot alter later reads', () => {
  const presets = getAllPresets() as WallpaperPreset[];

  expect(() => presets.pop()).toThrow();
  expect(getAllPresets()).toHaveLength(4);
});

test('looks up a preset by stable ID and handles missing IDs', () => {
  expect(getPresetById('paper-confidence')).toMatchObject({
    fontFamily: 'Lora',
    fontWeight: 'Regular',
    textAlign: 'left',
  });
  expect(getPresetById('not-a-preset')).toBeUndefined();
});

test('rejects an unsupported font family and weight pair at catalog load', () => {
  expect(() =>
    parseWallpaperPresetCatalog([
      { ...validPreset, fontFamily: 'DancingScript', fontWeight: 'Light' },
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

// Mutation caught: a preset without a catalog entry would render an empty name in Customize.
test('every preset has a name in the string catalog', () => {
  for (const preset of getAllPresets()) {
    expect(en[`preset.${preset.id}.name` as keyof typeof en]).toBeTruthy();
  }
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

// Mutation caught: resolving only presets.json would make every saved
// photograph look like a deleted preset and reset the reader to the default.
test('a photographic background resolves by id like any preset', () => {
  const background = getAllBackgrounds()[0]!;

  expect(getPresetById(background.id)).toBe(background);
  expect(getPresetById(background.id)?.background.kind).toBe('image');
});

// Mutation caught: letting the two catalogues overlap would give one id two
// different wallpapers, and the lookup would silently pick one.
test('the two catalogues are disjoint and together make the template list', () => {
  const presetIds = new Set(getAllPresets().map((preset) => preset.id));
  const backgroundIds = getAllBackgrounds().map((entry) => entry.id);

  expect(backgroundIds.filter((id) => presetIds.has(id))).toEqual([]);
  expect(getAllTemplates()).toHaveLength(
    getAllPresets().length + getAllBackgrounds().length,
  );
});

// Mutation caught: a preset carrying a category would be filed under a photo
// filter, and a background without one would vanish from every category.
test('only the photographs carry a category', () => {
  expect(getAllPresets().every((preset) => preset.category === undefined)).toBe(
    true,
  );
  expect(
    getAllBackgrounds().every((entry) => typeof entry.category === 'string'),
  ).toBe(true);
});
