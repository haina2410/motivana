import { Skia, type SkImage } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Image } from 'react-native';

import { backgroundAssets } from './backgroundAssets';
import { backgroundThumbAssets } from './backgroundThumbAssets';
import type { WallpaperBackground } from './types';

/**
 * Which size of a background to decode. The picker shows dozens of cards at
 * once and asks for `thumb`; the deck card and the export need the real thing.
 *
 * A full 1290x2796 background is about 13.8 MB decoded, so a grid of forty
 * would hold over half a gigabyte and crash a mid-range phone. A thumbnail is
 * about 0.4 MB.
 */
export type BackgroundImageVariant = 'thumb' | 'full';

/**
 * How many full-size backgrounds stay decoded at once.
 *
 * 1290 x 2796 x 4 bytes is 13.76 MB per photograph, so eight hold about 110 MB
 * -- a budget a 4 GB device can carry alongside the rest of the application.
 * The deck keeps three cards mounted and warms a fourth, so eight leaves twice
 * the working set as headroom and a swipe never evicts what is on screen.
 *
 * Without a bound the deck would walk the whole library in: forty backgrounds
 * is 577 MB decoded, and the deck re-rolls a random preset on every swipe up.
 */
export const FULL_CACHE_LIMIT = 8;

/**
 * Decoded backgrounds, one cache per variant. `thumb` is unbounded -- a
 * thumbnail is about 0.4 MB and the picker wants the whole grid at once --
 * while `full` is a least-recently-used cache holding FULL_CACHE_LIMIT
 * entries.
 */
const caches: Record<BackgroundImageVariant, Map<string, SkImage>> = {
  thumb: new Map(),
  full: new Map(),
};

/**
 * The decoded image, moved to the front of its cache's recency order.
 *
 * A Map iterates in insertion order, so deleting and re-setting a hit is what
 * makes the oldest key the first one `remember` drops.
 */
function recall(
  variant: BackgroundImageVariant,
  asset: string,
): SkImage | undefined {
  const cache = caches[variant];
  const image = cache.get(asset);
  if (image === undefined) return undefined;
  cache.delete(asset);
  cache.set(asset, image);
  return image;
}

function remember(
  variant: BackgroundImageVariant,
  asset: string,
  image: SkImage,
): void {
  const cache = caches[variant];
  cache.delete(asset);
  cache.set(asset, image);
  if (variant !== 'full') return;
  while (cache.size > FULL_CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    // Dropped, not disposed: a picture recorded from this image may still be
    // replaying on the render thread, and freeing it under that would crash.
    // Releasing the reference is what lets the collector reclaim the bytes.
    cache.delete(oldest.value);
  }
}

/** Test seam: drops every decoded background so a suite starts cold. */
export function clearBackgroundImageCache(): void {
  caches.thumb.clear();
  caches.full.clear();
}

const pendingByVariant: Record<
  BackgroundImageVariant,
  Map<string, Promise<SkImage | undefined>>
> = { thumb: new Map(), full: new Map() };

/** `backgrounds/mountain-01.webp` -> `mountain-01`. */
function assetId(asset: string): string {
  return asset.replace(/^backgrounds\//, '').replace(/\.webp$/, '');
}

async function decode(
  asset: string,
  variant: BackgroundImageVariant,
): Promise<SkImage | undefined> {
  const sources =
    variant === 'thumb' ? backgroundThumbAssets : backgroundAssets;
  const source = sources[assetId(asset)];
  if (source === undefined) return undefined;
  const data = await Skia.Data.fromURI(Image.resolveAssetSource(source).uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (image) remember(variant, asset, image);
  return image ?? undefined;
}

export function getBackgroundImage(
  asset: string,
  variant: BackgroundImageVariant = 'full',
): Promise<SkImage | undefined> {
  const ready = recall(variant, asset);
  if (ready) return Promise.resolve(ready);
  const pending = pendingByVariant[variant];
  let inFlight = pending.get(asset);
  if (!inFlight) {
    inFlight = decode(asset, variant).catch(() => undefined);
    pending.set(asset, inFlight);
    // Drop the record either way, so a failed decode can be retried on a
    // later mount rather than being remembered as a permanent absence.
    void inFlight.finally(() => pending.delete(asset));
  }
  return inFlight;
}

/**
 * The decoded photograph for a background, or null while it loads and for the
 * solid and gradient backgrounds that do not have one. The scene falls back to
 * the measured band colour until this resolves, so the card never flashes
 * empty.
 */
export function useBackgroundImage(
  background: WallpaperBackground,
  variant: BackgroundImageVariant = 'full',
): SkImage | null {
  const asset = background.kind === 'image' ? background.asset : undefined;
  // The cache is the single source of truth and is read during render, so an
  // already-decoded photograph is returned on the first frame. The counter
  // exists only to re-render once an in-flight decode lands.
  const [, decodeCount] = useState(0);

  useEffect(() => {
    if (!asset || caches[variant].has(asset)) return;
    let active = true;
    void getBackgroundImage(asset, variant).then(() => {
      if (active) decodeCount((count) => count + 1);
    });
    return () => {
      active = false;
    };
  }, [asset, variant]);

  // Reading through `recall` also marks the card on screen as the most
  // recently used, so a burst of swipes cannot evict the live wallpaper.
  return asset ? (recall(variant, asset) ?? null) : null;
}
