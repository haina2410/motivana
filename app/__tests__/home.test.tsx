/* eslint-disable @typescript-eslint/no-require-imports */

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { router } from 'expo-router';

import HomeScreen from '../(tabs)/index';
import { getAllQuotes } from '../../src/features/quotes/quoteRepository';
import { getAllTemplates } from '../../src/features/wallpaper/presetRepository';
import { useAppStore } from '../../src/store/useAppStore';
import { createDefaultPersistedAppState } from '../../src/store/schema';
import { setRotationSynchronizer } from '../../src/store/automationSynchronization';
import { t } from '../../src/features/i18n/t';

jest.mock('../../src/features/wallpaper/WallpaperCanvas', () => ({
  WallpaperCanvas: jest.fn(),
}));
jest.mock('../../src/features/wallpaper/useWallpaperFonts', () => ({
  useWallpaperFonts: jest.fn(),
}));
jest.mock('../../src/features/wallpaper/exportWallpaper', () => ({
  exportWallpaper: jest.fn(),
}));
jest.mock('../../src/services/mediaLibrary', () => ({
  saveWallpaper: jest.fn(),
}));
jest.mock('../../src/services/wallpaperNative', () => ({
  getWallpaperCapabilities: jest.fn(async () => ({
    supportsHome: true,
    supportsLock: false,
  })),
  setWallpaper: jest.fn(),
}));
jest.mock('../../src/components/SetWallpaperSheet', () => {
  const { Text, View } = require('react-native');
  return {
    SetWallpaperSheet: ({ visible }: { visible: boolean }) =>
      visible ? (
        <View>
          <Text>target sheet</Text>
        </View>
      ) : null,
  };
});
const mockUseWallpaperFonts = jest.requireMock(
  '../../src/features/wallpaper/useWallpaperFonts',
).useWallpaperFonts as jest.Mock;
const mockWallpaperCanvas = jest.requireMock(
  '../../src/features/wallpaper/WallpaperCanvas',
).WallpaperCanvas as jest.Mock;
const mockExportWallpaper = jest.requireMock(
  '../../src/features/wallpaper/exportWallpaper',
).exportWallpaper as jest.Mock;
const mockSaveWallpaper = jest.requireMock('../../src/services/mediaLibrary')
  .saveWallpaper as jest.Mock;
const retryFonts = jest.fn();

/** The canvas names the pair it drew, so the three deck faces can be told apart. */
function drawnFace(composition: {
  quote: { id: string };
  preset: { id: string };
}) {
  const { Text, View } = require('react-native');
  return (
    <View accessible accessibilityLabel="Wallpaper preview">
      <Text>{`face:${composition.quote.id}/${composition.preset.id}`}</Text>
    </View>
  );
}

beforeEach(() => {
  jest.mocked(router.push).mockClear();
  jest.mocked(router.navigate).mockClear();
  jest.clearAllMocks();
  mockUseWallpaperFonts.mockReturnValue({
    provider: {},
    failed: false,
    retry: retryFonts,
  });
  mockWallpaperCanvas.mockImplementation(
    ({ composition }: { composition: Parameters<typeof drawnFace>[0] }) =>
      drawnFace(composition),
  );
  useAppStore.setState(createDefaultPersistedAppState());
  setRotationSynchronizer(async () => undefined);
});

// Mutation caught: swallowing a rejected enabled-automation favorite change leaves users unable to retry the worker snapshot update.
test('Home shows a safe retry when favorite synchronization fails', async () => {
  let attempts = 0;
  setRotationSynchronizer(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('native secret');
  });
  useAppStore.setState({ rotationEnabled: true });
  render(<HomeScreen />);

  fireEvent.press(screen.getByLabelText(t('en', 'home.favorite.add.label')));
  await waitFor(() =>
    expect(screen.getByText(t('en', 'home.favorite.error'))).toBeOnTheScreen(),
  );
  expect(screen.queryByText('native secret')).toBeNull();
  fireEvent.press(
    screen.getByRole('button', { name: t('en', 'home.favorite.retry.label') }),
  );

  await waitFor(() =>
    expect(screen.getByText(t('en', 'home.favorite.added'))).toBeOnTheScreen(),
  );
  expect(attempts).toBe(2);
});

test('Home changes the favorite state through accessible controls', async () => {
  render(<HomeScreen />);

  fireEvent.press(screen.getByLabelText(t('en', 'home.favorite.add.label')));
  await waitFor(() =>
    expect(useAppStore.getState().favoriteQuoteIds).toContain(
      useAppStore.getState().currentQuoteId,
    ),
  );

  expect(screen.getByLabelText('Wallpaper preview')).toBeOnTheScreen();
});

// Mutation caught: pointing Restyle back at a deleted style route would dead-end the only path to the templates.
test('Home reaches settings and the presets, and opens the wallpaper target sheet', () => {
  render(<HomeScreen />);

  fireEvent.press(screen.getByLabelText(t('en', 'home.settings.label')));
  expect(router.push).toHaveBeenCalledWith('/settings');
  fireEvent.press(screen.getByLabelText(t('en', 'home.restyle.label')));
  expect(router.navigate).toHaveBeenCalledWith('/customize');

  expect(screen.queryByText('target sheet')).toBeNull();
  fireEvent.press(screen.getByLabelText(t('en', 'home.set.label')));
  expect(screen.getByText('target sheet')).toBeOnTheScreen();
});

// Mutation caught: leaving the deck on tap-to-advance strands the reader, because the full-bleed card has no visible tap target and no way back.
test('the deck advances and rewinds through the pager', () => {
  const advanceDeck = jest.fn().mockResolvedValue(true);
  const rewindDeck = jest.fn().mockResolvedValue(true);
  useAppStore.setState({ advanceDeck, rewindDeck });
  render(<HomeScreen />);

  const deck = screen.getByLabelText(t('en', 'home.deck.next.label'));
  fireEvent(deck, 'accessibilityAction', {
    nativeEvent: { actionName: 'activate' },
  });
  expect(advanceDeck).toHaveBeenCalledTimes(1);

  fireEvent(deck, 'accessibilityAction', {
    nativeEvent: { actionName: 'previous' },
  });
  expect(rewindDeck).toHaveBeenCalledTimes(1);
});

test('Home exposes branded loading and a retryable render error without losing state', () => {
  mockUseWallpaperFonts.mockReturnValue({
    provider: null,
    failed: false,
    retry: retryFonts,
  });
  const { unmount } = render(<HomeScreen />);
  expect(screen.getByText(t('en', 'home.loading'))).toBeOnTheScreen();
  unmount();

  mockUseWallpaperFonts.mockReturnValue({
    provider: {},
    failed: false,
    retry: retryFonts,
  });
  useAppStore.setState({ currentQuoteId: 'missing-quote' });
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    render(<HomeScreen />);
    expect(screen.getByText(t('en', 'home.preview.error'))).toBeOnTheScreen();
    fireEvent.press(
      screen.getByRole('button', { name: t('en', 'home.preview.retry.label') }),
    );
    expect(useAppStore.getState().currentQuoteId).toBe('missing-quote');
    expect(screen.getByText(t('en', 'home.preview.error'))).toBeOnTheScreen();
  } finally {
    errorSpy.mockRestore();
  }
});

test('Home catches a thrown preview render and retries without changing the quote or preset', () => {
  let shouldThrow = true;
  mockWallpaperCanvas.mockImplementation(
    ({ composition }: { composition: Parameters<typeof drawnFace>[0] }) => {
      if (shouldThrow) {
        throw new Error('Canvas failed to draw');
      }
      return drawnFace(composition);
    },
  );
  const before = useAppStore.getState();
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  try {
    render(<HomeScreen />);
    expect(screen.getByText(t('en', 'home.preview.error'))).toBeOnTheScreen();

    shouldThrow = false;
    fireEvent.press(
      screen.getByRole('button', { name: t('en', 'home.preview.retry.label') }),
    );

    expect(screen.getByLabelText('Wallpaper preview')).toBeOnTheScreen();
    expect(useAppStore.getState().currentQuoteId).toBe(before.currentQuoteId);
    expect(useAppStore.getState().selectedPresetId).toBe(
      before.selectedPresetId,
    );
  } finally {
    errorSpy.mockRestore();
  }
});

// Mutation caught: dropping the neighbour cards, or transposing them, leaves the drag showing the wrong wallpaper with nothing failing.
test('the deck mounts the previous and the next wallpaper around the live one', () => {
  const quotes = getAllQuotes();
  const presets = getAllTemplates();
  const trail = [
    { quoteId: quotes[0]!.id, presetId: presets[0]!.id },
    { quoteId: quotes[1]!.id, presetId: presets[1]!.id },
    { quoteId: quotes[2]!.id, presetId: presets[2]!.id },
  ];
  useAppStore.setState({
    currentQuoteId: trail[1]!.quoteId,
    selectedPresetId: trail[1]!.presetId,
    deckHistory: trail,
    deckCursor: 1,
  });
  render(<HomeScreen />);

  expect(screen.getAllByLabelText('Wallpaper preview')).toHaveLength(3);
  // DeckPager draws previous, then the live card, then next.
  expect(
    screen.getAllByText(/^face:/).map((node) => node.props.children as string),
  ).toEqual([
    `face:${trail[0]!.quoteId}/${trail[0]!.presetId}`,
    `face:${trail[1]!.quoteId}/${trail[1]!.presetId}`,
    `face:${trail[2]!.quoteId}/${trail[2]!.presetId}`,
  ]);
});

// Mutation caught: reading deckHistory raw would show a neighbour the store then refuses to move to, so the drag snaps back with nothing changed.
test('the deck drops its neighbours when a restyle leaves the trail behind', () => {
  const quotes = getAllQuotes();
  const presets = getAllTemplates();
  useAppStore.setState({
    currentQuoteId: quotes[1]!.id,
    selectedPresetId: presets[1]!.id,
    deckHistory: [
      { quoteId: quotes[0]!.id, presetId: presets[0]!.id },
      { quoteId: quotes[1]!.id, presetId: presets[1]!.id },
    ],
    deckCursor: 1,
  });
  // What /customize does: the preset moves, the trail does not.
  useAppStore.setState({ selectedPresetId: presets[2]!.id });
  render(<HomeScreen />);

  expect(screen.getAllByLabelText('Wallpaper preview')).toHaveLength(1);
});

// Mutation caught: dropping the busy guard starts a second Skia export on a double tap, and losing the confirmation leaves the reader unsure the file was written.
test('Home saves the wallpaper to the photo library one time per tap', async () => {
  mockExportWallpaper.mockResolvedValue({ uri: 'file:///exports/a.png' });
  mockSaveWallpaper.mockResolvedValue({ assetId: 'asset-1' });
  render(<HomeScreen />);

  const save = screen.getByLabelText(t('en', 'home.saveToLibrary.label'));
  fireEvent.press(save);
  fireEvent.press(save);

  await waitFor(() =>
    expect(
      screen.getByText(t('en', 'home.saved.confirmation')),
    ).toBeOnTheScreen(),
  );
  expect(mockExportWallpaper).toHaveBeenCalledTimes(1);
  expect(mockSaveWallpaper).toHaveBeenCalledWith('file:///exports/a.png');
});

// Mutation caught: swallowing the save failure tells the reader the wallpaper reached their photos when it did not.
test('Home reports a failed save without leaving the button stuck', async () => {
  mockExportWallpaper.mockRejectedValue(new Error('no surface'));
  render(<HomeScreen />);

  fireEvent.press(screen.getByLabelText(t('en', 'home.saveToLibrary.label')));

  await waitFor(() =>
    expect(screen.getByText(t('en', 'home.saved.error'))).toBeOnTheScreen(),
  );
  expect(mockSaveWallpaper).not.toHaveBeenCalled();
  // The guard released, so the reader can try again.
  mockExportWallpaper.mockResolvedValue({ uri: 'file:///exports/a.png' });
  mockSaveWallpaper.mockResolvedValue({ assetId: 'asset-1' });
  fireEvent.press(screen.getByLabelText(t('en', 'home.saveToLibrary.label')));
  await waitFor(() => expect(mockSaveWallpaper).toHaveBeenCalledTimes(1));
});

// Mutation caught: a rejected typeface load left the deck on a spinner forever, with no error and no way out.
test('Home offers the render error and a retry when the typefaces fail to load', () => {
  mockUseWallpaperFonts.mockReturnValue({
    provider: null,
    failed: true,
    retry: retryFonts,
  });
  render(<HomeScreen />);

  expect(screen.queryByText(t('en', 'home.loading'))).toBeNull();
  expect(screen.getByText(t('en', 'home.preview.error'))).toBeOnTheScreen();
  fireEvent.press(
    screen.getByRole('button', { name: t('en', 'home.preview.retry.label') }),
  );
  expect(retryFonts).toHaveBeenCalledTimes(1);
});
