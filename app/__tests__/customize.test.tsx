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

test('selecting every catalog preset persists it and returns Home', () => {
  render(<CustomizeScreen />);

  const presetButtons = screen.getAllByLabelText(/^Use .* preset$/);
  expect(presetButtons).toHaveLength(8);
  fireEvent.press(screen.getByLabelText('Use Forest Discipline preset'));

  expect(useAppStore.getState().selectedPresetId).toBe('forest-discipline');
  expect(router.back).toHaveBeenCalledTimes(1);
});
