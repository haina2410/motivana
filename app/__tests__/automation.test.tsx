import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import AutomationScreen from '../automation';
import { createDefaultPersistedAppState } from '../../src/store/schema';
import { setRotationSynchronizer } from '../../src/store/automationSynchronization';
import { useAppStore } from '../../src/store/useAppStore';
import { t } from '../../src/features/i18n/t';

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
      intervalHours: state.rotationIntervalHours,
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
        screen.getByText(
          t('en', 'automation.status.capability', { kind: 'available' }),
        ),
      ).toBeOnTheScreen(),
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
  expect(
    screen.getByText(
      t('en', 'automation.status.capability', {
        kind: t('en', 'automation.status.loading'),
      }),
    ),
  ).toBeOnTheScreen();
});

test('Automation validates favorites-only scheduling while clearly reporting unavailable native status', async () => {
  render(<AutomationScreen />);

  await waitFor(() =>
    expect(
      screen.getByText(
        t('en', 'automation.status.capability', { kind: 'available' }),
      ),
    ).toBeOnTheScreen(),
  );

  expect(
    screen.getByText(t('en', 'automation.available.title')),
  ).toBeOnTheScreen();
  expect(
    screen.getByText(
      t('en', 'automation.status.capability', { kind: 'available' }),
    ),
  ).toBeOnTheScreen();
  expect(screen.getByText(t('en', 'rotation.runs.status'))).toBeOnTheScreen();
  expect(
    screen.getByText(t('en', 'automation.state.disabled')),
  ).toBeOnTheScreen();
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
      screen.getByText(
        t('en', 'automation.status.capability', { kind: 'available' }),
      ),
    ).toBeOnTheScreen(),
  );
  fireEvent.press(
    screen.getByLabelText(t('en', 'automation.interval.option', { hours: 6 })),
  );
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
    expect(useAppStore.getState().rotationIntervalHours).toBe(6),
  );
  expect(useAppStore.getState().wallpaperTarget).toBe('home');
  expect(useAppStore.getState().rotationEnabled).toBe(false);
});

test('does not mutate Zustand when native scheduling rejects', async () => {
  nativeService.configureRotation.mockRejectedValueOnce({
    code: 'CONFIGURE_FAILED',
  });
  render(<AutomationScreen />);
  await waitFor(() =>
    expect(
      screen.getByText(
        t('en', 'automation.status.capability', { kind: 'available' }),
      ),
    ).toBeOnTheScreen(),
  );
  fireEvent.press(
    screen.getByLabelText(t('en', 'automation.interval.option', { hours: 6 })),
  );
  fireEvent.press(
    screen.getByRole('button', { name: t('en', 'automation.save') }),
  );
  await waitFor(() =>
    expect(nativeService.configureRotation).toHaveBeenCalledWith(
      expect.objectContaining({ intervalHours: 6 }),
    ),
  );
  expect(useAppStore.getState().rotationIntervalHours).toBe(24);
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
