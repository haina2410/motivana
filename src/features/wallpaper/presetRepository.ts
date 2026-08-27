import catalog from '../../../assets/data/backgrounds.json';
import { parseWallpaperPresetCatalog, type WallpaperPreset } from './types';

/**
 * One catalogue, two kinds of entry. A photographic background carries a
 * category; a plain preset -- the eight curated colours and gradients -- does
 * not. That one field is what the picker's "Plain" filter reads, and what the
 * sourcing skill uses to leave the presets alone when it rewrites the file.
 */
const templates = parseWallpaperPresetCatalog(catalog);
const presets = Object.freeze(
  templates.filter((template) => template.category === undefined),
);
const backgrounds = Object.freeze(
  templates.filter((template) => template.category !== undefined),
);
const templatesById = new Map(
  templates.map((template) => [template.id, template]),
);

/** The curated plain presets, in catalogue order. */
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

/** Resolves any id in the catalogue, so a saved photograph survives a restart. */
export function getPresetById(id: string): WallpaperPreset | undefined {
  return templatesById.get(id);
}
