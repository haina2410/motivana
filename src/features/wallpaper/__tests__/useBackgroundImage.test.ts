import { Image } from 'react-native';

import {
  FULL_CACHE_LIMIT,
  clearBackgroundImageCache,
  getBackgroundImage,
} from '../useBackgroundImage';

const decodes: string[] = [];

jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Data: { fromURI: (uri: string) => Promise.resolve({ uri }) },
    Image: {
      MakeImageFromEncoded: (data: { uri: string }) => ({ uri: data.uri }),
    },
  },
}));
// Every id resolves to a stand-in source, so the test can ask for more
// backgrounds than the cache holds without touching real image bytes.
jest.mock('../backgroundAssets', () => ({
  backgroundAssets: new Proxy(
    {},
    { get: (_target, key: string) => `asset:${key}` },
  ),
}));
jest.mock('../backgroundThumbAssets', () => ({
  backgroundThumbAssets: new Proxy(
    {},
    { get: (_target, key: string) => `thumb:${key}` },
  ),
}));

const asset = (index: number) => `backgrounds/photo-${index}.webp`;

beforeEach(() => {
  decodes.length = 0;
  clearBackgroundImageCache();
  // Every entry in the mocked catalogues is its own uri, so the recorded
  // calls are exactly the decodes the cache did not serve.
  jest
    .spyOn(Image, 'resolveAssetSource')
    .mockImplementation((source: unknown) => {
      decodes.push(source as string);
      return { uri: source as string, width: 1, height: 1, scale: 1 };
    });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Mutation caught: an unbounded full cache walks the whole 40-background
// library into memory -- 577 MB decoded -- because the deck re-rolls a random
// preset on every swipe up.
test('evicts the least recently used full background and decodes it again on request', async () => {
  for (let index = 0; index <= FULL_CACHE_LIMIT; index += 1) {
    await getBackgroundImage(asset(index), 'full');
  }
  expect(decodes).toHaveLength(FULL_CACHE_LIMIT + 1);

  // The oldest key was pushed out, so asking for it decodes a second time.
  await getBackgroundImage(asset(0), 'full');
  expect(decodes).toHaveLength(FULL_CACHE_LIMIT + 2);

  // The newest key is still held, so it is served without decoding.
  await getBackgroundImage(asset(FULL_CACHE_LIMIT), 'full');
  expect(decodes).toHaveLength(FULL_CACHE_LIMIT + 2);
});

// Mutation caught: evicting in insertion order rather than by recency drops
// the wallpaper on screen while the reader is looking at it.
test('a read keeps a background alive through later decodes', async () => {
  await getBackgroundImage(asset(0), 'full');
  for (let index = 1; index < FULL_CACHE_LIMIT; index += 1) {
    await getBackgroundImage(asset(index), 'full');
  }
  // Touching the oldest entry makes it the newest.
  await getBackgroundImage(asset(0), 'full');
  await getBackgroundImage(asset(FULL_CACHE_LIMIT), 'full');
  const decodesSoFar = decodes.length;

  await getBackgroundImage(asset(0), 'full');

  expect(decodes).toHaveLength(decodesSoFar);
});

// Mutation caught: bounding the thumbnails too would make the picker grid
// re-decode as it scrolls, for 0.4 MB a card.
test('keeps every thumbnail, which the picker grid shows at once', async () => {
  for (let index = 0; index <= FULL_CACHE_LIMIT * 2; index += 1) {
    await getBackgroundImage(asset(index), 'thumb');
  }
  const decodesSoFar = decodes.length;

  await getBackgroundImage(asset(0), 'thumb');

  expect(decodes).toHaveLength(decodesSoFar);
});
