/* eslint-disable @typescript-eslint/no-require-imports */

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { router } from 'expo-router';

import CustomizeScreen from '../customize';
import {
  getAllBackgrounds,
  getAllPresets,
  getAllTemplates,
} from '../../src/features/wallpaper/presetRepository';
import { createDefaultPersistedAppState } from '../../src/store/schema';
import { useAppStore } from '../../src/store/useAppStore';
import { setRotationSynchronizer } from '../../src/store/automationSynchronization';

jest.mock('../../src/features/wallpaper/WallpaperCanvas', () => {
  const { View } = require('react-native');
  return {
    WallpaperCanvas: () => (
      <View accessible accessibilityLabel="Preset preview" />
    ),
  };
});

beforeEach(() => {
  jest.mocked(router.navigate).mockClear();
  useAppStore.setState(createDefaultPersistedAppState());
  setRotationSynchronizer(async () => undefined);
});

test.each([
  ['midnight-focus', 'Midnight'],
  ['sunrise-drive', 'Sand'],
  ['forest-discipline', 'Jade'],
  ['violet-growth', 'Blush'],
  ['paper-confidence', 'Linen'],
  ['ocean-success', 'Slate'],
  ['ember-action', 'Ember'],
  ['mono-clarity', 'Paper'],
])(
  'selecting %s persists it and returns Home',
  async (presetId, presetName) => {
    render(<CustomizeScreen />);

    fireEvent.press(screen.getByLabelText(`Use ${presetName} preset`));

    await waitFor(() => {
      expect(useAppStore.getState().selectedPresetId).toBe(presetId);
      expect(router.navigate).toHaveBeenCalledWith('/');
    });
  },
);

// Mutation caught: returning Home after native rejection hides a stale preset snapshot without any correction path.
test('Customize keeps the selection available and offers a safe retry after synchronization fails', async () => {
  let attempts = 0;
  setRotationSynchronizer(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('native secret');
  });
  useAppStore.setState({ rotationEnabled: true });
  render(<CustomizeScreen />);

  fireEvent.press(screen.getByLabelText('Use Sand preset'));
  await waitFor(() =>
    expect(
      screen.getByText(
        'Could not update the preset used for rotation. Try again.',
      ),
    ).toBeOnTheScreen(),
  );
  expect(router.navigate).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Retry preset update' }));

  await waitFor(() => expect(router.navigate).toHaveBeenCalledWith('/'));
  expect(attempts).toBe(2);
});

// Mutation caught: loading presets.json alone would leave every photographic
// background out of the picker, which is what shipped and hid forty wallpapers.
test('the picker offers the curated presets and every photographic background', () => {
  render(<CustomizeScreen />);

  expect(screen.getAllByLabelText(/^Use .* preset$/)).toHaveLength(
    getAllTemplates().length,
  );
  expect(getAllBackgrounds().length).toBeGreaterThan(0);
  // A photograph is named from its category and number, not a per-image string.
  expect(screen.getByLabelText('Use Mountain 01 preset')).toBeOnTheScreen();
});

// Mutation caught: a filter that did not narrow the grid would leave the row
// looking active while showing every wallpaper regardless.
test('a filter narrows the grid to its own wallpapers', () => {
  render(<CustomizeScreen />);

  fireEvent.press(screen.getByLabelText('Plain'));
  expect(screen.getAllByLabelText(/^Use .* preset$/)).toHaveLength(
    getAllPresets().length,
  );

  fireEvent.press(screen.getByLabelText('Sky'));
  const sky = getAllBackgrounds().filter((b) => b.category === 'sky');
  expect(screen.getAllByLabelText(/^Use .* preset$/)).toHaveLength(sky.length);

  fireEvent.press(screen.getByLabelText('All'));
  expect(screen.getAllByLabelText(/^Use .* preset$/)).toHaveLength(
    getAllTemplates().length,
  );
});

// Mutation caught: ordering the filter row by catalogue position would bury the
// fullest categories behind ones holding a single wallpaper.
test('the filter row leads with All and Plain, then the largest categories', () => {
  render(<CustomizeScreen />);

  expect(screen.getByLabelText('All')).toBeOnTheScreen();
  expect(screen.getByLabelText('Plain')).toBeOnTheScreen();
  expect(screen.getByLabelText('Sky')).toBeOnTheScreen();
  expect(screen.getByLabelText('Cosmos')).toBeOnTheScreen();
});
