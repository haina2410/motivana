import { createComposition } from '../composition';
import { exportWallpaper, type ExportDependencies } from '../exportWallpaper';
import { RenderError } from '../renderErrors';
import { getPresetById } from '../presetRepository';
import type { Quote } from '../../quotes/types';
import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';

const mockParagraphProviders: unknown[] = [];
const mockNativeCanvas = {
  drawRect: () => undefined,
  drawCircle: () => undefined,
};
const mockNativeSurface = {
  getCanvas: () => mockNativeCanvas,
  flush: () => undefined,
  makeImageSnapshot: () => ({
    encodeToBytes: () => new Uint8Array([137, 80, 78, 71]),
    dispose: () => undefined,
  }),
  dispose: () => undefined,
};

jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Color: (color: string) => color,
    Paint: () => ({
      setColor: () => undefined,
      setAlphaf: () => undefined,
      setShader: () => undefined,
      dispose: () => undefined,
    }),
    Point: (x: number, y: number) => ({ x, y }),
    XYWHRect: (x: number, y: number, width: number, height: number) => ({
      x,
      y,
      width,
      height,
    }),
    Shader: { MakeLinearGradient: () => undefined },
    Surface: { MakeOffscreen: () => mockNativeSurface },
    ParagraphBuilder: {
      Make: (_style: unknown, provider: unknown) => {
        mockParagraphProviders.push(provider);
        return {
          addText: () => undefined,
          build: () => ({
            layout: () => undefined,
            paint: () => undefined,
            getHeight: () => 160,
            getLineMetrics: () => [{}],
            dispose: () => undefined,
          }),
          dispose: () => undefined,
        };
      },
    },
  },
  TextAlign: { Left: 0, Center: 1, Right: 2 },
  TileMode: { Clamp: 0 },
}));
jest.mock('expo-file-system', () => ({
  Directory: class {
    create() {}
  },
  File: class {
    uri = 'file:///cache/motivana-exports/default.png';
    create() {}
    write() {}
  },
  Paths: { cache: 'file:///cache' },
}));

const loadedFontProvider = {} as SkTypefaceFontProvider;

const composition = createComposition({
  quote: {
    id: 'export-quote',
    category: 'success',
    sourceLocale: 'en',
    text: { en: 'Success is the sum of small efforts repeated every day.' },
    author: 'Robert Collier',
  } satisfies Quote,
  preset: getPresetById('midnight-focus')!,
  width: 1080,
  height: 2400,
  locale: 'en',
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

function exportWithDependencies(
  input: typeof composition,
  dependencies: ExportDependencies,
) {
  return exportWallpaper(input, loadedFontProvider, dependencies);
}

// Mutation caught: allocating a preview-sized surface or omitting the scene draw would produce an unusable export.
test('exports a drawn PNG at the exact full-resolution composition dimensions', async () => {
  const dependencies = workingDependencies();

  const result = await exportWithDependencies(composition, dependencies);

  expect(result).toEqual({
    uri: `file:///cache/motivana-exports/${composition.cacheKey}.png`,
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
    exportWithDependencies(invalid, workingDependencies()),
  ).rejects.toMatchObject({
    name: 'RenderError',
    code,
  });
});

// Mutation caught: treating a missing offscreen surface as a generic write error hides the recoverable renderer failure.
test('maps a missing Skia surface to SURFACE_CREATION_FAILED', async () => {
  const dependencies = workingDependencies();
  dependencies.createSurface = () => null;

  await expect(
    exportWithDependencies(composition, dependencies),
  ).rejects.toEqual(new RenderError('SURFACE_CREATION_FAILED'));
});

// Mutation caught: letting a native allocation exception escape would force UI callers to parse platform-specific errors.
test('maps a throwing surface factory to SURFACE_CREATION_FAILED', async () => {
  const dependencies = workingDependencies();
  dependencies.createSurface = () => {
    throw new Error('oom');
  };
  await expect(
    exportWithDependencies(composition, dependencies),
  ).rejects.toEqual(new RenderError('SURFACE_CREATION_FAILED'));
});

// Mutation caught: allowing a scene exception to escape leaks a native implementation error to the UI.
test('maps scene drawing failures to DRAW_FAILED', async () => {
  const dependencies = workingDependencies();
  dependencies.drawScene = () => {
    throw new Error('paragraph failure');
  };

  await expect(
    exportWithDependencies(composition, dependencies),
  ).rejects.toEqual(new RenderError('DRAW_FAILED'));
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

  await expect(
    exportWithDependencies(composition, dependencies),
  ).rejects.toEqual(new RenderError('ENCODE_FAILED'));
});

// Mutation caught: snapshot/encoding native exceptions must be stable render errors and still release acquired native resources.
test.each(['snapshot', 'encoder'])(
  'maps a throwing %s path to ENCODE_FAILED and cleans up',
  async (throwAt) => {
    const dependencies = workingDependencies();
    const disposeSurface = jest.fn();
    const disposeImage = jest.fn();
    dependencies.createSurface = () => ({
      getCanvas: () => ({}),
      flush: () => undefined,
      makeImageSnapshot: () => {
        if (throwAt === 'snapshot') throw new Error('snapshot');
        return {
          encodeToBytes: () => {
            throw new Error('encode');
          },
          dispose: disposeImage,
        };
      },
      dispose: disposeSurface,
    });

    await expect(
      exportWithDependencies(composition, dependencies),
    ).rejects.toEqual(new RenderError('ENCODE_FAILED'));
    expect(disposeSurface).toHaveBeenCalledTimes(1);
    expect(disposeImage).toHaveBeenCalledTimes(throwAt === 'encoder' ? 1 : 0);
  },
);

// Mutation caught: treating the loaded provider as export dependencies or omitting it makes the default export use fallback typography.
test('renders the default export scene with the loaded font provider', async () => {
  mockParagraphProviders.length = 0;

  await expect(
    exportWallpaper(composition, loadedFontProvider),
  ).resolves.toMatchObject({ width: 1080, height: 2400 });

  expect(mockParagraphProviders).toContain(loadedFontProvider);
});

// Mutation caught: swallowing a filesystem exception would report an export whose PNG was never persisted.
test('maps file persistence failures to FILE_WRITE_FAILED', async () => {
  const dependencies = workingDependencies();
  dependencies.writePng = () => {
    throw new Error('disk full');
  };

  await expect(
    exportWithDependencies(composition, dependencies),
  ).rejects.toEqual(new RenderError('FILE_WRITE_FAILED'));
});

jest.mock('../useBackgroundImage', () => ({
  getBackgroundImage: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getBackgroundImage } = require('../useBackgroundImage') as {
  getBackgroundImage: jest.Mock;
};

const imageComposition = () =>
  createComposition({
    quote: {
      id: 'export-quote',
      category: 'success',
      sourceLocale: 'en',
      text: { en: 'Success is the sum of small efforts repeated every day.' },
      author: 'Robert Collier',
    } satisfies Quote,
    preset: {
      ...getPresetById('midnight-focus')!,
      background: {
        kind: 'image',
        asset: 'backgrounds/mountain-01.webp',
        scrimColor: '#000000',
        scrimOpacity: 0.6,
        effectiveLuminance: 0.12,
      },
    },
    width: 1080,
    height: 2400,
    locale: 'en',
  });

// Mutation caught: exporting before the photograph is decoded writes the
// stand-in colour, so the reader applies a plain grey screen as a wallpaper.
test('hands the decoded photograph to the draw for an image background', async () => {
  const handed: unknown[] = [];
  const decodedImage = { width: () => 1290, height: () => 2796 };
  getBackgroundImage.mockResolvedValueOnce(decodedImage);
  const dependencies = workingDependencies();
  const inner = dependencies.drawScene;
  dependencies.drawScene = (target, composition, backgroundImage) => {
    handed.push(backgroundImage);
    inner(target, composition, backgroundImage);
  };

  await exportWithDependencies(imageComposition(), dependencies);

  expect(getBackgroundImage).toHaveBeenCalledWith(
    'backgrounds/mountain-01.webp',
  );
  expect(handed).toEqual([decodedImage]);
});

// Mutation caught: treating a failed decode as "carry on" silently exports a
// blank wallpaper instead of telling the reader the render failed.
test('fails the export when the photograph cannot be decoded', async () => {
  getBackgroundImage.mockResolvedValueOnce(undefined);

  await expect(
    exportWithDependencies(imageComposition(), workingDependencies()),
  ).rejects.toMatchObject({ code: 'DRAW_FAILED' });
});
