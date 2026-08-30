/* eslint-disable @typescript-eslint/no-require-imports */

import { Dimensions, PixelRatio, StyleSheet } from 'react-native';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { router } from 'expo-router';

import HomeScreen from '../(tabs)/index';
import { createComposition } from '../../src/features/wallpaper/composition';
import { wallpaperPixelDimensions } from '../../src/features/wallpaper/dimensions';
import {
  getAllQuotes,
  getQuoteById,
} from '../../src/features/quotes/quoteRepository';
import {
  getAllTemplates,
  getPresetById,
} from '../../src/features/wallpaper/presetRepository';
import { useAppStore } from '../../src/store/useAppStore';
import { createDefaultPersistedAppState } from '../../src/store/schema';
import { setRotationSynchronizer } from '../../src/store/automationSynchronization';
import { t, type StringKey } from '../../src/features/i18n/t';
import { spacing } from '../../src/theme/spacing';

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
const mockGetBackgroundImage = jest.fn().mockResolvedValue(undefined);
jest.mock('../../src/features/wallpaper/useBackgroundImage', () => ({
  useBackgroundImage: () => null,
  getBackgroundImage: (...args: unknown[]) => mockGetBackgroundImage(...args),
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

// Captured before any test can replace them. setState shallow-merges, so a
// test that stubs a deck action would otherwise leak the stub into the rest
// of the file, where clearAllMocks then blanks it; a replace would wipe every
// action instead, because this store keeps its actions alongside its data.
const { advanceDeck, rewindDeck } = useAppStore.getState();

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
  useAppStore.setState({
    ...createDefaultPersistedAppState(),
    deckHistory: [],
    deckCursor: -1,
    advanceDeck,
    rewindDeck,
  });
  setRotationSynchronizer(async () => undefined);
});

// Mutation caught: a beforeEach that restores neither the trail nor the deck
// actions leaves the next test in the file exercising the previous test's
// stub, with nothing to say so.
test('starts each test on the real deck actions and an empty trail', () => {
  expect(useAppStore.getState().advanceDeck).toBe(advanceDeck);
  expect(useAppStore.getState().rewindDeck).toBe(rewindDeck);
  expect(useAppStore.getState().deckHistory).toEqual([]);
  expect(useAppStore.getState().deckCursor).toBe(-1);
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

// Mutation caught: discarding advanceDeck's boolean freezes the deck with no
// message and no retry -- the card animates back to centre and nothing else
// on screen says the move was refused.
test('Home reports a refused swipe up, and stays quiet at the start of the trail', async () => {
  useAppStore.setState({
    advanceDeck: jest.fn().mockResolvedValue(false),
    rewindDeck: jest.fn().mockResolvedValue(false),
  });
  render(<HomeScreen />);
  const deck = screen.getByLabelText(t('en', 'home.deck.next.label'));

  // A swipe down at the start of the trail is a normal no-op, not a failure.
  fireEvent(deck, 'accessibilityAction', {
    nativeEvent: { actionName: 'previous' },
  });
  await waitFor(() =>
    expect(screen.queryByText(t('en', 'home.deck.error'))).toBeNull(),
  );

  fireEvent(deck, 'accessibilityAction', {
    nativeEvent: { actionName: 'activate' },
  });

  await waitFor(() =>
    expect(screen.getByText(t('en', 'home.deck.error'))).toBeOnTheScreen(),
  );
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
  // Nor does it warm an image for a card the deck cannot reach.
  expect(mockGetBackgroundImage).not.toHaveBeenCalled();
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

/**
 * Reconstructs the same position PresetCaption in app/(tabs)/index.tsx
 * derives, independently of that file, so the test fails if either the
 * scale or the anchor drifts from what it actually does. `box` stands in
 * for the measured viewport -- the same box WallpaperCanvas cover-fits
 * the composition into -- not the window.
 */
function expectedCaptionPosition(
  quoteId: string,
  presetId: string,
  box: { width: number; height: number },
) {
  const state = useAppStore.getState();
  const window = Dimensions.get('window');
  const dimensions = wallpaperPixelDimensions(
    window.width,
    window.height,
    PixelRatio.get(),
  );
  const composition = createComposition({
    quote: getQuoteById(quoteId)!,
    preset: getPresetById(presetId)!,
    width: dimensions.width,
    height: dimensions.height,
    locale: state.contentLocale,
  });
  // Cover, not contain: the deck fills the box on both axes and centres what
  // overflows, so the caption has to carry the same offset the picture does.
  const scale = Math.max(
    box.width / composition.width,
    box.height / composition.height,
  );
  const offsetX = (box.width - composition.width * scale) / 2;
  const offsetY = (box.height - composition.height * scale) / 2;
  // The lower of the quote block and the author line: an attributed quote's
  // author sits close enough under the quote that quoteBounds alone is not
  // a safe anchor.
  const contentBottom = Math.max(
    composition.quoteBounds.y + composition.quoteBounds.height,
    composition.authorY + composition.authorLineHeight,
  );
  return {
    composition,
    scale,
    offsetY,
    left: offsetX + composition.quoteBounds.x * scale,
    top: offsetY + contentBottom * scale + spacing.x3 + 1 + spacing.x2,
  };
}

function captionStyle() {
  const label = screen.getByText(
    t(
      'en',
      `preset.${useAppStore.getState().selectedPresetId}.name` as StringKey,
    ),
  );
  return StyleSheet.flatten(label.props.style) as {
    top?: number;
    left?: number;
  };
}

// Mutation caught: scaling the caption against the window instead of the
// measured viewport box (or scaling by width or height alone) drifts it off
// an attributed quote once the in-flow tab bar shortens that box, landing it
// on the author line or the footer rail instead of under the quote.
test('positions the preset name from the measured viewport box, not the window', () => {
  const growthQuote = getAllQuotes().find(
    (quote) => quote.id === 'growth-014',
  )!;
  useAppStore.setState({
    currentQuoteId: growthQuote.id,
    selectedPresetId: 'midnight-focus',
    deckHistory: [{ quoteId: growthQuote.id, presetId: 'midnight-focus' }],
    deckCursor: 0,
  });
  render(<HomeScreen />);

  // Deliberately wider (relative to its height) than the composition's own
  // aspect ratio, so the height-driven ratio is the larger of the two --
  // catching a contain fit, which would pick the other one -- and not
  // proportional to the window either, so a baseline mistake also predicts a
  // different left or top than this box's own cover-fit.
  const box = { width: 390, height: 600 };
  fireEvent(screen.getByTestId('wallpaper-viewport'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, ...box } },
  });

  const expected = expectedCaptionPosition('growth-014', 'midnight-focus', box);
  const style = captionStyle();
  expect(style.left).toBeCloseTo(expected.left, 5);
  expect(style.top).toBeCloseTo(expected.top, 5);
});

// Mutation caught: an anchor read from quoteBounds alone, ignoring the
// author line, still passes a "top > 0" check while the label sits on top
// of the author's name for the catalogue's longest quote.
test('keeps the preset name below the longest catalogue quote without crossing the author line', () => {
  useAppStore.setState({
    currentQuoteId: 'confidence-012',
    selectedPresetId: 'midnight-focus',
    deckHistory: [{ quoteId: 'confidence-012', presetId: 'midnight-focus' }],
    deckCursor: 0,
  });
  render(<HomeScreen />);

  const box = { width: 390, height: 760 };
  fireEvent(screen.getByTestId('wallpaper-viewport'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, ...box } },
  });

  const expected = expectedCaptionPosition(
    'confidence-012',
    'midnight-focus',
    box,
  );
  const style = captionStyle();
  expect(style.left).toBeCloseTo(expected.left, 5);
  expect(style.top).toBeCloseTo(expected.top, 5);
  expect(style.top!).toBeGreaterThanOrEqual(
    expected.offsetY +
      (expected.composition.quoteBounds.y +
        expected.composition.quoteBounds.height) *
        expected.scale,
  );
  expect(style.top!).toBeGreaterThanOrEqual(
    expected.offsetY +
      (expected.composition.authorY + expected.composition.authorLineHeight) *
        expected.scale,
  );
});

// Mutation caught: an anchor that stops applying once fitText clamps to its
// minimum size and truncates would leave the caption sitting mid-quote
// instead of below the clamped block.
test('keeps the preset name below a truncated quote block', () => {
  const originalWindow = Dimensions.get('window');
  useAppStore.setState({
    currentQuoteId: 'confidence-012',
    selectedPresetId: 'midnight-focus',
    deckHistory: [{ quoteId: 'confidence-012', presetId: 'midnight-focus' }],
    deckCursor: 0,
  });
  // Squat enough that fitText clamps to the minimum size and truncates --
  // verified against composition.truncated below, not assumed.
  Dimensions.set({
    window: { width: 1500, height: 60, scale: 2, fontScale: 1 },
  });
  const { unmount } = render(<HomeScreen />);
  try {
    // Not proportional to the truncating window itself, and cover picks the
    // width-driven ratio here, so this still tells a wrong baseline or a
    // contain fit from the right answer.
    const box = { width: 2400, height: 80 };
    fireEvent(screen.getByTestId('wallpaper-viewport'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, ...box } },
    });

    const expected = expectedCaptionPosition(
      'confidence-012',
      'midnight-focus',
      box,
    );
    expect(expected.composition.truncated).toBe(true);
    const style = captionStyle();
    expect(style.left).toBeCloseTo(expected.left, 5);
    expect(style.top).toBeCloseTo(expected.top, 5);
  } finally {
    unmount();
    Dimensions.set({ window: originalWindow });
  }
});

// Mutation caught: without a prefetch the first swipe onto an undecoded photograph shows the fallback band colour instead of the picture.
test('warms the decode for the next photographic background', async () => {
  const photograph = getAllTemplates().find(
    (template) => template.background.kind === 'image',
  )!;
  useAppStore.setState({
    deckHistory: [
      {
        quoteId: useAppStore.getState().currentQuoteId,
        presetId: 'midnight-focus',
      },
      {
        quoteId: useAppStore.getState().currentQuoteId,
        presetId: photograph.id,
      },
    ],
    deckCursor: 0,
  });

  render(<HomeScreen />);

  await waitFor(() =>
    expect(mockGetBackgroundImage).toHaveBeenCalledWith(
      (photograph.background as { asset: string }).asset,
      'full',
    ),
  );
});
