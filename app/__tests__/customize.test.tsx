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
  jest.mocked(router.back).mockClear();
  useAppStore.setState(createDefaultPersistedAppState());
  setRotationSynchronizer(async () => undefined);
});

test.each([
  ['midnight-focus', 'Midnight Focus'],
  ['sunrise-drive', 'Sunrise Drive'],
  ['forest-discipline', 'Forest Discipline'],
  ['violet-growth', 'Violet Growth'],
  ['paper-confidence', 'Paper Confidence'],
  ['ocean-success', 'Ocean Success'],
  ['ember-action', 'Ember Action'],
  ['mono-clarity', 'Mono Clarity'],
])(
  'selecting %s persists it and returns Home',
  async (presetId, presetName) => {
    render(<CustomizeScreen />);

    expect(screen.getAllByLabelText(/^Use .* preset$/)).toHaveLength(8);
    fireEvent.press(screen.getByLabelText(`Use ${presetName} preset`));

    await waitFor(() => {
      expect(useAppStore.getState().selectedPresetId).toBe(presetId);
      expect(router.back).toHaveBeenCalledTimes(1);
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

  fireEvent.press(screen.getByLabelText('Use Sunrise Drive preset'));
  await waitFor(() =>
    expect(
      screen.getByText(
        'Could not update the preset used for rotation. Try again.',
      ),
    ).toBeOnTheScreen(),
  );
  expect(router.back).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Retry preset update' }));

  await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  expect(attempts).toBe(2);
});
