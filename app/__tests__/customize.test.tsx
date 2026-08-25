/* eslint-disable @typescript-eslint/no-require-imports */

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { router } from 'expo-router';

import CustomizeScreen from '../customize';
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

    expect(screen.getAllByLabelText(/^Use .* preset$/)).toHaveLength(8);
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
