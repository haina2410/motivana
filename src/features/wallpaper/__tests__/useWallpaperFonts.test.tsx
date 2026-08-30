import { render, waitFor } from '@testing-library/react-native';
import { Image, Text } from 'react-native';

import { useWallpaperFonts } from '../useWallpaperFonts';

const mockFromURI = jest.fn((_uri: string) => Promise.resolve({}));

jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Data: { fromURI: (uri: string) => mockFromURI(uri) },
    Typeface: { MakeFreeTypeFaceFromData: () => ({}) },
    TypefaceFontProvider: { Make: () => ({ registerFont: jest.fn() }) },
  },
}));

function FontProbe() {
  const { provider } = useWallpaperFonts();
  return <Text>{provider ? 'ready' : 'loading'}</Text>;
}

beforeAll(() => {
  jest
    .spyOn(Image, 'resolveAssetSource')
    .mockReturnValue({ uri: 'font.ttf' } as never);
});

// Mutation caught: loading the typefaces per hook instance would read every font file again for each preview.
test('reads each wallpaper font file one time for previews that mount together', async () => {
  const screen = render(
    <>
      <FontProbe />
      <FontProbe />
      <FontProbe />
    </>,
  );

  await waitFor(() => expect(screen.getAllByText('ready')).toHaveLength(3));
  expect(mockFromURI).toHaveBeenCalledTimes(6);
});

// Mutation caught: keeping no loaded provider would read every font file again when a later screen mounts.
test('reuses the loaded provider for a preview that mounts later', async () => {
  const screen = render(<FontProbe />);

  expect(screen.getByText('ready')).toBeTruthy();
  expect(mockFromURI).toHaveBeenCalledTimes(6);
});
