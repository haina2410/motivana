import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import backgrounds from '../../../../assets/data/backgrounds.json';
import { backgroundAssets } from '../backgroundAssets';
import { parseWallpaperPresetCatalog } from '../types';

/**
 * The lock screen keeps two strips for itself. Above, the Android 12+ large
 * clock is the tallest thing that lands there; below, the shortcut row and the
 * home indicator. A quote drawn into either strip collides with system UI on a
 * real phone, so the whole text block has to sit between them.
 */
const CLOCK_SAFE_TOP = 0.3;
const BOTTOM_SAFE = 0.84;
const MAX_LINES = 3;
const AUTHOR_LINES = 0.7;

describe('backgrounds catalogue', () => {
  const parsed = parseWallpaperPresetCatalog(backgrounds);

  const imageDirectory = join(
    __dirname,
    '../../../../assets/images/backgrounds',
  );
  const onDisk = readdirSync(imageDirectory)
    .filter((name) => name.endsWith('.webp'))
    .map((name) => name.slice(0, -'.webp'.length))
    .sort();

  it('parses every entry under the wallpaper preset validator', () => {
    expect(parsed.length).toBeGreaterThan(0);
  });

  /**
   * A background is retired by deleting its file, so the folder and the
   * catalogue drift apart the moment anyone reviews the set. Neither side
   * complains on its own: a catalogue entry with no file becomes a dangling
   * require() that fails the bundle, and a file with no entry ships bytes the
   * app can never show. Re-run the skill's `sync` stage to repair.
   */
  it('matches the images actually bundled', () => {
    expect(parsed.map((preset) => preset.id).sort()).toEqual(onDisk);
    expect(Object.keys(backgroundAssets).sort()).toEqual(onDisk);
  });

  it('backs every entry with a bundled image', () => {
    for (const preset of parsed) {
      expect(preset.background.kind).toBe('image');
    }
  });

  it('keeps ids unique and aligned with their asset', () => {
    for (const preset of parsed) {
      if (preset.background.kind !== 'image') {
        throw new Error('expected an image background');
      }
      expect(preset.background.asset).toBe(`backgrounds/${preset.id}.webp`);
    }
  });

  it('keeps the quote clear of the clock and the bottom shortcuts', () => {
    for (const preset of parsed) {
      const blockHeight =
        preset.preferredFontSizeRatio *
        (MAX_LINES * preset.lineHeight + AUTHOR_LINES);
      const top = preset.quotePositionY - blockHeight / 2;
      const bottom = preset.quotePositionY + blockHeight / 2;
      expect({ id: preset.id, top: top >= CLOCK_SAFE_TOP }).toEqual({
        id: preset.id,
        top: true,
      });
      expect({ id: preset.id, bottom: bottom <= BOTTOM_SAFE }).toEqual({
        id: preset.id,
        bottom: true,
      });
    }
  });
});
