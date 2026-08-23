import { createComposition } from '../composition';
import { exportWallpaper, type ExportDependencies } from '../exportWallpaper';
import { RenderError } from '../renderErrors';
import { getPresetById } from '../presetRepository';
import type { Quote } from '../../quotes/types';

jest.mock('@shopify/react-native-skia', () => ({}));
jest.mock('expo-file-system', () => ({}));

const composition = createComposition({
  quote: {
    id: 'export-quote',
    text: 'Success is the sum of small efforts repeated every day.',
    author: 'Robert Collier',
    category: 'success',
  } satisfies Quote,
  preset: getPresetById('midnight-focus')!,
  width: 1080,
  height: 2400,
});

function workingDependencies(): ExportDependencies & {
  read(uri: string): Uint8Array | undefined;
} {
  const files = new Map<string, Uint8Array>();
  const canvas = { drewScene: false };
  const image = {
    encodeToBytes: () => new Uint8Array([137, 80, 78, 71]),
    dispose: () => undefined,
  };
  const surface = {
    getCanvas: () => canvas,
    flush: () => undefined,
    makeImageSnapshot: () => image,
    dispose: () => undefined,
  };
  return {
    createSurface: (width, height) =>
      width === 1080 && height === 2400 ? surface : null,
    drawScene: (target) => {
      (target as typeof canvas).drewScene = true;
    },
    writePng: (cacheKey, pngBytes) => {
      if (!canvas.drewScene) {
        throw new Error('scene was not drawn');
      }
      const uri = `file:///cache/motivana-exports/${cacheKey}.png`;
      files.set(uri, pngBytes);
      return uri;
    },
    read: (uri) => files.get(uri),
  };
}

// Mutation caught: allocating a preview-sized surface or omitting the scene draw would produce an unusable export.
test('exports a drawn PNG at the exact full-resolution composition dimensions', async () => {
  const dependencies = workingDependencies();

  const result = await exportWallpaper(composition, dependencies);

  expect(result).toEqual({
    uri: 'file:///cache/motivana-exports/midnight-focus-export-quote-1080x2400.png',
    width: 1080,
    height: 2400,
  });
  expect(dependencies.read(result.uri)).toEqual(
    new Uint8Array([137, 80, 78, 71]),
  );
});

// Mutation caught: validating after surface allocation would allow invalid dimensions to exhaust native memory.
test.each([
  [{ ...composition, width: 719 }, 'INVALID_DIMENSIONS'],
  [{ ...composition, width: 1080, height: 1080 }, 'INVALID_DIMENSIONS'],
  [{ ...composition, width: 5000, height: 5000 }, 'INVALID_DIMENSIONS'],
])('rejects invalid dimensions before export: %s', async (invalid, code) => {
  await expect(
    exportWallpaper(invalid, workingDependencies()),
  ).rejects.toMatchObject({
    name: 'RenderError',
    code,
  });
});

// Mutation caught: treating a missing offscreen surface as a generic write error hides the recoverable renderer failure.
test('maps a missing Skia surface to SURFACE_CREATION_FAILED', async () => {
  const dependencies = workingDependencies();
  dependencies.createSurface = () => null;

  await expect(exportWallpaper(composition, dependencies)).rejects.toEqual(
    new RenderError('SURFACE_CREATION_FAILED'),
  );
});

// Mutation caught: allowing a scene exception to escape leaks a native implementation error to the UI.
test('maps scene drawing failures to DRAW_FAILED', async () => {
  const dependencies = workingDependencies();
  dependencies.drawScene = () => {
    throw new Error('paragraph failure');
  };

  await expect(exportWallpaper(composition, dependencies)).rejects.toEqual(
    new RenderError('DRAW_FAILED'),
  );
});

// Mutation caught: writing empty encoded bytes would create a corrupt wallpaper file.
test('maps PNG encode failure to ENCODE_FAILED', async () => {
  const dependencies = workingDependencies();
  dependencies.createSurface = () => ({
    getCanvas: () => ({}),
    flush: () => undefined,
    makeImageSnapshot: () => ({
      encodeToBytes: () => new Uint8Array(),
      dispose: () => undefined,
    }),
    dispose: () => undefined,
  });

  await expect(exportWallpaper(composition, dependencies)).rejects.toEqual(
    new RenderError('ENCODE_FAILED'),
  );
});

// Mutation caught: swallowing a filesystem exception would report an export whose PNG was never persisted.
test('maps file persistence failures to FILE_WRITE_FAILED', async () => {
  const dependencies = workingDependencies();
  dependencies.writePng = () => {
    throw new Error('disk full');
  };

  await expect(exportWallpaper(composition, dependencies)).rejects.toEqual(
    new RenderError('FILE_WRITE_FAILED'),
  );
});
