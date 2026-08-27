import backgroundCatalog from '../../../assets/data/backgrounds.json';
import presetCatalog from '../../../assets/data/presets.json';
import { parseWallpaperPresetCatalog, type WallpaperPreset } from './types';

/**
 * Two catalogues, one lookup. The eight curated presets and the photographic
 * backgrounds are validated by the same parser but kept in separate files:
 * a background carries a category, a safe area and a licence record that a
 * preset has no use for, and verify-data.mjs holds presets.json to a fixed set
 * of stable ids.
 */
const presets = parseWallpaperPresetCatalog(presetCatalog);
const backgrounds = parseWallpaperPresetCatalog(backgroundCatalog);
const templates = Object.freeze([...presets, ...backgrounds]);
const templatesById = new Map(
  templates.map((template) => [template.id, template]),
);

export function getAllPresets(): readonly WallpaperPreset[] {
  return presets;
}

/** The photographic backgrounds, in catalogue order. */
export function getAllBackgrounds(): readonly WallpaperPreset[] {
  return backgrounds;
}

/** Everything the reader can choose: the curated presets, then the photographs. */
export function getAllTemplates(): readonly WallpaperPreset[] {
  return templates;
}

/** Resolves an id from either catalogue, so a saved photograph survives a restart. */
export function getPresetById(id: string): WallpaperPreset | undefined {
  return templatesById.get(id);
}
