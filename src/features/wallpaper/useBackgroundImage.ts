import { Skia, type SkImage } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Image } from 'react-native';

import { backgroundAssets } from './backgroundAssets';
import type { WallpaperBackground } from './types';

/**
 * Decoded backgrounds, kept for the life of the application.
 *
 * Ninety photographs are far too much to decode eagerly, so each one is loaded
 * the first time a preset asks for it and then held. A decoded 1290x2796 image
 * costs a few megabytes of memory, and a reader only ever moves through a
 * handful of presets in a session.
 */
const decoded = new Map<string, SkImage>();
const pending = new Map<string, Promise<SkImage | undefined>>();

/** `backgrounds/mountain-01.webp` -> `mountain-01`. */
function assetId(asset: string): string {
  return asset.replace(/^backgrounds\//, '').replace(/\.webp$/, '');
}

async function decode(asset: string): Promise<SkImage | undefined> {
  const source = backgroundAssets[assetId(asset)];
  if (source === undefined) return undefined;
  const data = await Skia.Data.fromURI(Image.resolveAssetSource(source).uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (image) decoded.set(asset, image);
  return image ?? undefined;
}

export function getBackgroundImage(
  asset: string,
): Promise<SkImage | undefined> {
  const ready = decoded.get(asset);
  if (ready) return Promise.resolve(ready);
  let inFlight = pending.get(asset);
  if (!inFlight) {
    inFlight = decode(asset).catch(() => undefined);
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
): SkImage | null {
  const asset = background.kind === 'image' ? background.asset : undefined;
  // The cache is the single source of truth and is read during render, so an
  // already-decoded photograph is returned on the first frame. The counter
  // exists only to re-render once an in-flight decode lands.
  const [, decodeCount] = useState(0);

  useEffect(() => {
    if (!asset || decoded.has(asset)) return;
    let active = true;
    void getBackgroundImage(asset).then(() => {
      if (active) decodeCount((count) => count + 1);
    });
    return () => {
      active = false;
    };
  }, [asset]);

  return asset ? (decoded.get(asset) ?? null) : null;
}
