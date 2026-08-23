import presetCatalog from '../../../assets/data/presets.json';
import { parseWallpaperPresetCatalog, type WallpaperPreset } from './types';

const presets = parseWallpaperPresetCatalog(presetCatalog);
const presetsById = new Map(presets.map((preset) => [preset.id, preset]));

export function getAllPresets(): readonly WallpaperPreset[] {
  return presets;
}

export function getPresetById(id: string): WallpaperPreset | undefined {
  return presetsById.get(id);
}
