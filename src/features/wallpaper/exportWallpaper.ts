import { Skia, type SkTypefaceFontProvider } from '@shopify/react-native-skia';
import { Directory, File, Paths } from 'expo-file-system';

import type { RenderedWallpaper, WallpaperComposition } from './composition';
import { drawWallpaperScene } from './scene';
import { RenderError } from './renderErrors';

const MINIMUM_EXPORT_WIDTH = 720;
const MAXIMUM_RGBA_BYTES = 64 * 1024 * 1024;

interface NativeImage {
  encodeToBytes(): Uint8Array | null | undefined;
  dispose?(): void;
}

interface NativeSurface {
  getCanvas(): unknown;
  flush(): void;
  makeImageSnapshot(): NativeImage;
  dispose?(): void;
}

export interface ExportDependencies {
  createSurface(width: number, height: number): NativeSurface | null;
  drawScene(canvas: unknown, composition: WallpaperComposition): void;
  writePng(cacheKey: string, pngBytes: Uint8Array): string;
}

export function createExportDependencies(
  fontProvider?: SkTypefaceFontProvider,
): ExportDependencies {
  return {
    createSurface: (width, height) => Skia.Surface.MakeOffscreen(width, height),
    drawScene: (canvas, composition) =>
      drawWallpaperScene(canvas, composition, fontProvider),
    writePng: (cacheKey, pngBytes) => {
      const directory = new Directory(Paths.cache, 'motivana-exports');
      directory.create({ idempotent: true, intermediates: true });
      const output = new File(directory, `${cacheKey}.png`);
      output.create({ overwrite: true, intermediates: true });
      output.write(pngBytes);
      return output.uri;
    },
  };
}

function hasSafeExportDimensions(composition: WallpaperComposition): boolean {
  const { width, height } = composition;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < MINIMUM_EXPORT_WIDTH ||
    height <= width
  ) {
    return false;
  }
  return width <= MAXIMUM_RGBA_BYTES / 4 / height;
}

export async function exportWallpaper(
  composition: WallpaperComposition,
  dependencies: ExportDependencies = createExportDependencies(),
): Promise<RenderedWallpaper> {
  if (!hasSafeExportDimensions(composition)) {
    throw new RenderError('INVALID_DIMENSIONS');
  }

  const surface = dependencies.createSurface(
    composition.width,
    composition.height,
  );
  if (surface === null) {
    throw new RenderError('SURFACE_CREATION_FAILED');
  }

  let image: NativeImage | undefined;
  try {
    try {
      dependencies.drawScene(surface.getCanvas(), composition);
      surface.flush();
    } catch {
      throw new RenderError('DRAW_FAILED');
    }

    image = surface.makeImageSnapshot();
    const pngBytes = image.encodeToBytes();
    if (!pngBytes || pngBytes.length === 0) {
      throw new RenderError('ENCODE_FAILED');
    }

    try {
      const uri = dependencies.writePng(composition.cacheKey, pngBytes);
      return { uri, width: composition.width, height: composition.height };
    } catch {
      throw new RenderError('FILE_WRITE_FAILED');
    }
  } finally {
    image?.dispose?.();
    surface.dispose?.();
  }
}
