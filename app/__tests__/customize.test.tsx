/* eslint-disable @typescript-eslint/no-require-imports */

import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import CustomizeScreen from '../customize';
import { createDefaultPersistedAppState } from '../../src/store/schema';
import { useAppStore } from '../../src/store/useAppStore';

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
])('selecting %s persists it and returns Home', (presetId, presetName) => {
  render(<CustomizeScreen />);

  expect(screen.getAllByLabelText(/^Use .* preset$/)).toHaveLength(8);
  fireEvent.press(screen.getByLabelText(`Use ${presetName} preset`));

  expect(useAppStore.getState().selectedPresetId).toBe(presetId);
  expect(router.back).toHaveBeenCalledTimes(1);
});
