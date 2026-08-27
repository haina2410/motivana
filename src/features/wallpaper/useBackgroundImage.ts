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
 * Decoded backgrounds, kept for the life of the application, one cache per
 * variant. Each is loaded the first time something asks for it and then held.
 */
const caches: Record<BackgroundImageVariant, Map<string, SkImage>> = {
  thumb: new Map(),
  full: new Map(),
};
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
  if (image) caches[variant].set(asset, image);
  return image ?? undefined;
}

export function getBackgroundImage(
  asset: string,
  variant: BackgroundImageVariant = 'full',
): Promise<SkImage | undefined> {
  const ready = caches[variant].get(asset);
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

  return asset ? (caches[variant].get(asset) ?? null) : null;
}
