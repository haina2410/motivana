import type { WallpaperPreset } from './types';

export type TemplateFilterId = string;

export interface TemplateFilter {
  /** `all`, `plain`, or a category name from the background catalogue. */
  id: TemplateFilterId;
  count: number;
}

export const ALL_FILTER = 'all';
export const PLAIN_FILTER = 'plain';

/**
 * The filter row above the grid: everything, the curated solid and gradient
 * presets, then one filter per photographic category.
 *
 * Categories are ordered by how many wallpapers they hold, largest first, so
 * the fullest filters are the ones in reach. Ties break alphabetically, which
 * keeps the row stable as the catalogue grows rather than reordering on every
 * added photograph.
 */
export function templateFilters(
  templates: readonly WallpaperPreset[],
): TemplateFilter[] {
  const counts = new Map<string, number>();
  let plain = 0;
  for (const template of templates) {
    if (template.category === undefined) {
      plain += 1;
      continue;
    }
    counts.set(template.category, (counts.get(template.category) ?? 0) + 1);
  }
  const categories = [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((left, right) =>
      right.count === left.count
        ? left.id.localeCompare(right.id)
        : right.count - left.count,
    );
  return [
    { id: ALL_FILTER, count: templates.length },
    ...(plain > 0 ? [{ id: PLAIN_FILTER, count: plain }] : []),
    ...categories,
  ];
}

/** The wallpapers a filter holds, in catalogue order. */
export function filterTemplates(
  templates: readonly WallpaperPreset[],
  filter: TemplateFilterId,
): readonly WallpaperPreset[] {
  if (filter === ALL_FILTER) return templates;
  if (filter === PLAIN_FILTER) {
    return templates.filter((template) => template.category === undefined);
  }
  return templates.filter((template) => template.category === filter);
}
