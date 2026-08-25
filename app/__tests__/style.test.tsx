/* eslint-disable @typescript-eslint/no-require-imports */

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { router } from 'expo-router';

import StyleScreen from '../style';
import { getAllPresets } from '../../src/features/wallpaper/presetRepository';
import { createDefaultPersistedAppState } from '../../src/store/schema';
import { setRotationSynchronizer } from '../../src/store/automationSynchronization';
import { useAppStore } from '../../src/store/useAppStore';
import { t } from '../../src/features/i18n/t';

jest.mock('../../src/features/wallpaper/WallpaperCanvas', () => {
  const { View } = require('react-native');
  return {
    WallpaperCanvas: () => (
      <View accessible accessibilityLabel="Style preview" />
    ),
  };
});

beforeEach(() => {
  jest.mocked(router.back).mockClear();
  useAppStore.setState(createDefaultPersistedAppState());
  setRotationSynchronizer(async () => undefined);
});

// Mutation caught: a typeface swatch that did not move the preset would leave the
// scheduled wallpaper on the previous face while the preview showed the new one.
test('choosing a typeface moves the selection onto a preset that uses it', async () => {
  render(<StyleScreen />);

  fireEvent.press(
    screen.getByLabelText(
      t('en', 'style.typeface.option', { name: 'Dancing Script' }),
    ),
  );

  await waitFor(() => {
    const selected = getAllPresets().find(
      (preset) => preset.id === useAppStore.getState().selectedPresetId,
    );
    expect(selected?.fontFamily).toBe('DancingScript');
  });
});

test('Style offers one swatch per bundled family and previews the selection', () => {
  render(<StyleScreen />);

  expect(screen.getByLabelText('Style preview')).toBeOnTheScreen();
  expect(screen.getAllByLabelText(/^Set the typeface to /)).toHaveLength(4);
  expect(screen.getByText(t('en', 'style.typeface.label'))).toBeOnTheScreen();
});

// Mutation caught: a size or line-height control the reader could move would
// diverge from the Kotlin rotation renderer, which only reads the preset.
test('reports the preset type metrics without offering to change them', () => {
  render(<StyleScreen />);
  const preset = getAllPresets().find(
    (candidate) => candidate.id === useAppStore.getState().selectedPresetId,
  )!;

  expect(
    screen.getByLabelText(
      t('en', 'style.lineHeight.note', {
        value: preset.lineHeight.toFixed(2),
      }),
    ),
  ).toBeOnTheScreen();
  expect(
    screen.getByLabelText(t('en', 'style.alignment.center')),
  ).toBeDisabled();
  expect(screen.getByText(t('en', 'style.readOnly'))).toBeOnTheScreen();
});

test('Done and Close both return to the deck', () => {
  render(<StyleScreen />);

  fireEvent.press(screen.getByRole('button', { name: t('en', 'style.done') }));
  fireEvent.press(
    screen.getByRole('button', { name: t('en', 'style.close.label') }),
  );

  expect(router.back).toHaveBeenCalledTimes(2);
});

// Mutation caught: swallowing a rejected preset write would leave the reader
// believing the typeface changed when the rotation snapshot refused it.
test('reports a refused typeface change', async () => {
  setRotationSynchronizer(async () => {
    throw new Error('native secret');
  });
  useAppStore.setState({ rotationEnabled: true });
  render(<StyleScreen />);

  fireEvent.press(
    screen.getByLabelText(t('en', 'style.typeface.option', { name: 'Lora' })),
  );

  await waitFor(() =>
    expect(screen.getByText(t('en', 'style.error'))).toBeOnTheScreen(),
  );
  expect(screen.queryByText('native secret')).toBeNull();
});
