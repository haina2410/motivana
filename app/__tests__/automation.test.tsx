import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import AutomationScreen from '../(tabs)/automation';
import { createDefaultPersistedAppState } from '../../src/store/schema';
import { setRotationSynchronizer } from '../../src/store/automationSynchronization';
import { useAppStore } from '../../src/store/useAppStore';
import { t } from '../../src/features/i18n/t';
import { rotationSchedulePlan } from '../../src/features/rotation/schedule';

jest.mock('../../src/services/wallpaperNative', () => ({
  getWallpaperCapabilities: jest.fn(async () => ({
    supportsHome: true,
    supportsLock: false,
  })),
  configureRotation: jest.fn(async () => undefined),
  getRotationStatus: jest.fn(async () => ({
    enabled: false,
    state: 'disabled',
  })),
  runRotationNow: jest.fn(async () => undefined),
}));

const nativeService = jest.requireMock(
  '../../src/services/wallpaperNative',
) as {
  getWallpaperCapabilities: jest.Mock;
  configureRotation: jest.Mock;
  getRotationStatus: jest.Mock;
  runRotationNow: jest.Mock;
};

beforeEach(() => {
  useAppStore.setState(createDefaultPersistedAppState());
  nativeService.getWallpaperCapabilities.mockResolvedValue({
    supportsHome: true,
    supportsLock: false,
  });
  nativeService.configureRotation.mockResolvedValue(undefined);
  nativeService.getRotationStatus.mockResolvedValue({
    enabled: false,
    state: 'disabled',
  });
  nativeService.runRotationNow.mockResolvedValue(undefined);
  setRotationSynchronizer(async (state) =>
    nativeService.configureRotation({
      enabled: state.rotationEnabled,
      ...rotationSchedulePlan(state.rotationSchedule),
      target: state.wallpaperTarget,
      selectedPresetId: state.selectedPresetId,
      randomizePreset: state.randomizePreset,
      favoriteQuoteIds: state.favoriteQuoteIds,
      favoriteQuotesOnly: state.favoriteQuotesOnly,
      contentLocale: state.contentLocale,
    }),
  );
});

test.each(['lock', 'both'] as const)(
  'preserves supported persisted %s target when live capability arrives',
  async (target) => {
    useAppStore.setState({ wallpaperTarget: target });
    nativeService.getWallpaperCapabilities.mockResolvedValue({
      supportsHome: true,
      supportsLock: true,
    });
    render(<AutomationScreen />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: t('en', 'automation.save') }),
      ).toBeEnabled(),
    );
    fireEvent.press(
      screen.getByRole('button', { name: t('en', 'automation.save') }),
    );
    await waitFor(() =>
      expect(nativeService.configureRotation).toHaveBeenCalled(),
    );
    expect(useAppStore.getState().wallpaperTarget).toBe(target);
  },
);

test('disables Save while capability support is still loading', () => {
  nativeService.getWallpaperCapabilities.mockReturnValue(new Promise(() => {}));
  render(<AutomationScreen />);
  expect(
    screen.getByRole('button', { name: t('en', 'automation.save') }),
  ).toBeDisabled();
});

test('Automation validates favorites-only scheduling while clearly reporting unavailable native status', async () => {
  render(<AutomationScreen />);

  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: t('en', 'automation.save') }),
    ).toBeEnabled(),
  );

  fireEvent.press(screen.getByLabelText(t('en', 'rotation.source.saved')));
  fireEvent.press(
    screen.getByRole('button', { name: t('en', 'automation.save') }),
  );

  expect(
    screen.getByText(t('en', 'automation.favoritesOnly.error')),
  ).toBeOnTheScreen();
  expect(useAppStore.getState().rotationEnabled).toBe(false);
});

test('Automation stores supported preferences and keeps unavailable targets disabled', async () => {
  render(<AutomationScreen />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: t('en', 'automation.save') }),
    ).toBeEnabled(),
  );
  fireEvent.press(screen.getByLabelText(t('en', 'automation.schedule.hourly')));
  fireEvent.press(screen.getByLabelText(t('en', 'automation.target.both')));
  fireEvent.press(screen.getByLabelText(t('en', 'automation.target.lock')));

  expect(
    screen.getByLabelText(t('en', 'automation.target.lock')),
  ).toBeDisabled();
  expect(
    screen.getByLabelText(t('en', 'automation.target.both')),
  ).toBeDisabled();
  fireEvent.press(
    screen.getByRole('button', { name: t('en', 'automation.save') }),
  );
  await waitFor(() =>
    expect(useAppStore.getState().rotationSchedule).toBe('hourly'),
  );
  expect(useAppStore.getState().wallpaperTarget).toBe('home');
  expect(useAppStore.getState().rotationEnabled).toBe(false);
});

// Mutation caught: a randomize switch that only moved locally would report a
// saved preference the next launch could not honour.
test('Automation saves the randomize-preset preference with the schedule', async () => {
  render(<AutomationScreen />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: t('en', 'automation.save') }),
    ).toBeEnabled(),
  );

  fireEvent.press(screen.getByLabelText(t('en', 'rotation.randomize.label')));
  expect(useAppStore.getState().randomizePreset).toBe(false);

  fireEvent.press(
    screen.getByRole('button', { name: t('en', 'automation.save') }),
  );
  await waitFor(() =>
    expect(useAppStore.getState().randomizePreset).toBe(true),
  );
});

test('does not mutate Zustand when native scheduling rejects', async () => {
  nativeService.configureRotation.mockRejectedValueOnce({
    code: 'CONFIGURE_FAILED',
  });
  render(<AutomationScreen />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: t('en', 'automation.save') }),
    ).toBeEnabled(),
  );
  fireEvent.press(screen.getByLabelText(t('en', 'automation.schedule.hourly')));
  fireEvent.press(
    screen.getByRole('button', { name: t('en', 'automation.save') }),
  );
  await waitFor(() =>
    expect(nativeService.configureRotation).toHaveBeenCalledWith(
      expect.objectContaining({ intervalHours: 1 }),
    ),
  );
  expect(useAppStore.getState().rotationSchedule).toBe('daily');
});

// Mutation caught: rendering a native worker code directly could expose implementation details instead of a recovery path.
test('maps scheduled worker failures to safe recovery text and an action', async () => {
  nativeService.getRotationStatus.mockResolvedValue({
    enabled: true,
    state: 'failed',
    errorCode: 'SYSTEM_FAILED',
  });
  render(<AutomationScreen />);

  await waitFor(() =>
    expect(
      screen.getByText(
        'Android could not finish the scheduled rotation. Try again.',
      ),
    ).toBeOnTheScreen(),
  );
  expect(screen.queryByText('Last error: SYSTEM_FAILED')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Retry rotation' }),
  ).toBeOnTheScreen();
});

// Mutation caught: falling back to a hardcoded home target would select a
// screen the device cannot set, on a device that only supports the lock screen.
test('falls back to the best supported target when the saved one is unavailable', async () => {
  useAppStore.setState({ wallpaperTarget: 'both' });
  nativeService.getWallpaperCapabilities.mockResolvedValue({
    supportsHome: false,
    supportsLock: true,
  });
  render(<AutomationScreen />);

  await waitFor(() =>
    expect(screen.getByLabelText(t('en', 'automation.target.lock'))).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    ),
  );
});
