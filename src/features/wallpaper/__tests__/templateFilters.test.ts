import {
  ALL_FILTER,
  PLAIN_FILTER,
  filterTemplates,
  templateFilters,
} from '../templateFilters';
import {
  getAllBackgrounds,
  getAllPresets,
  getAllTemplates,
} from '../presetRepository';
import type { WallpaperPreset } from '../types';

function template(id: string, category?: string): WallpaperPreset {
  return {
    id,
    ...(category === undefined ? {} : { category }),
  } as WallpaperPreset;
}

// Mutation caught: ordering the row by catalogue position would bury the
// fullest categories behind ones holding a single wallpaper.
test('categories are ordered by count, largest first', () => {
  const filters = templateFilters([
    template('a'),
    template('sky-1', 'sky'),
    template('sky-2', 'sky'),
    template('sky-3', 'sky'),
    template('ocean-1', 'ocean'),
    template('cosmos-1', 'cosmos'),
  ]);

  expect(filters).toEqual([
    { id: ALL_FILTER, count: 6 },
    { id: PLAIN_FILTER, count: 1 },
    { id: 'sky', count: 3 },
    { id: 'cosmos', count: 1 },
    { id: 'ocean', count: 1 },
  ]);
});

// Mutation caught: an unstable tie-break would reshuffle the row whenever a
// photograph was added to an unrelated category.
test('equal counts break alphabetically rather than by catalogue order', () => {
  const filters = templateFilters([
    template('texture-1', 'texture'),
    template('mountain-1', 'mountain'),
    template('botanical-1', 'botanical'),
  ]);

  expect(filters.map((filter) => filter.id)).toEqual([
    ALL_FILTER,
    'botanical',
    'mountain',
    'texture',
  ]);
});

// Mutation caught: offering a Plain filter with nothing behind it would render
// an empty grid on a catalogue of photographs only.
test('the plain filter is absent when every template is a photograph', () => {
  const filters = templateFilters([template('sky-1', 'sky')]);

  expect(filters.map((filter) => filter.id)).toEqual([ALL_FILTER, 'sky']);
});

describe('filtering', () => {
  const templates = [
    template('violet-growth'),
    template('sky-1', 'sky'),
    template('ocean-1', 'ocean'),
  ];

  test('all returns every template untouched', () => {
    expect(filterTemplates(templates, ALL_FILTER)).toEqual(templates);
  });

  test('plain returns only the templates with no category', () => {
    expect(filterTemplates(templates, PLAIN_FILTER).map((t) => t.id)).toEqual([
      'violet-growth',
    ]);
  });

  test('a category returns only its own', () => {
    expect(filterTemplates(templates, 'sky').map((t) => t.id)).toEqual([
      'sky-1',
    ]);
  });

  test('an unknown filter returns nothing rather than everything', () => {
    expect(filterTemplates(templates, 'weather')).toEqual([]);
  });
});

// Mutation caught: a filter row built from a category the strings do not cover
// would render a raw identifier like "nocturne" in the interface.
test('the real catalogue splits into plain presets and photographs', () => {
  const filters = templateFilters(getAllTemplates());
  const byId = new Map(filters.map((filter) => [filter.id, filter.count]));

  expect(byId.get(ALL_FILTER)).toBe(getAllTemplates().length);
  expect(byId.get(PLAIN_FILTER)).toBe(getAllPresets().length);
  // Every photograph lands in exactly one category filter.
  const categorised = filters
    .filter((filter) => filter.id !== ALL_FILTER && filter.id !== PLAIN_FILTER)
    .reduce((total, filter) => total + filter.count, 0);
  expect(categorised).toBe(getAllBackgrounds().length);
});
