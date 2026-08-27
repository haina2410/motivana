import {
  Skia,
  type SkImage,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import { Directory, Paths } from 'expo-file-system';

import type { RenderedWallpaper, WallpaperComposition } from './composition';
import { EXPORT_DIRECTORY_NAME, exportedWallpaperFile } from './exportCache';
import { drawWallpaperScene, measureSkiaComposition } from './scene';
import { getBackgroundImage } from './useBackgroundImage';
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
  drawScene(
    canvas: unknown,
    composition: WallpaperComposition,
    backgroundImage?: SkImage,
  ): void;
  writePng(cacheKey: string, pngBytes: Uint8Array): string;
}

export function createExportDependencies(
  fontProvider: SkTypefaceFontProvider,
): ExportDependencies {
  return {
    createSurface: (width, height) => Skia.Surface.MakeOffscreen(width, height),
    drawScene: (canvas, composition, backgroundImage) =>
      drawWallpaperScene(canvas, composition, fontProvider, backgroundImage),
    writePng: (cacheKey, pngBytes) => {
      const directory = new Directory(Paths.cache, EXPORT_DIRECTORY_NAME);
      directory.create({ idempotent: true, intermediates: true });
      const output = exportedWallpaperFile(cacheKey);
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
  fontProvider: SkTypefaceFontProvider,
  dependencies: ExportDependencies = createExportDependencies(fontProvider),
): Promise<RenderedWallpaper> {
  if (!hasSafeExportDimensions(composition)) {
    throw new RenderError('INVALID_DIMENSIONS');
  }
  const measuredComposition = measureSkiaComposition(composition, fontProvider);

  // The export is the file the reader actually sets as their wallpaper, so the
  // photograph has to be decoded before the draw rather than filled in later.
  // Exporting the stand-in colour would hand them a plain grey screen.
  const { background } = measuredComposition.preset;
  let backgroundImage: SkImage | undefined;
  if (background.kind === 'image') {
    backgroundImage = await getBackgroundImage(background.asset);
    if (!backgroundImage) {
      throw new RenderError('DRAW_FAILED');
    }
  }

  let surface: NativeSurface | null;
  try {
    surface = dependencies.createSurface(
      measuredComposition.width,
      measuredComposition.height,
    );
  } catch {
    throw new RenderError('SURFACE_CREATION_FAILED');
  }
  if (surface === null) {
    throw new RenderError('SURFACE_CREATION_FAILED');
  }

  let image: NativeImage | undefined;
  try {
    try {
      dependencies.drawScene(
        surface.getCanvas(),
        measuredComposition,
        backgroundImage,
      );
      surface.flush();
    } catch {
      throw new RenderError('DRAW_FAILED');
    }

    let pngBytes: Uint8Array | null | undefined;
    try {
      image = surface.makeImageSnapshot();
      pngBytes = image.encodeToBytes();
    } catch {
      throw new RenderError('ENCODE_FAILED');
    }
    if (!pngBytes || pngBytes.length === 0) {
      throw new RenderError('ENCODE_FAILED');
    }

    try {
      const uri = dependencies.writePng(measuredComposition.cacheKey, pngBytes);
      return {
        uri,
        width: measuredComposition.width,
        height: measuredComposition.height,
      };
    } catch {
      throw new RenderError('FILE_WRITE_FAILED');
    }
  } finally {
    image?.dispose?.();
    surface.dispose?.();
  }
}
