import {
  act,
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
import { rotationSchedulePlan } from '../../src/features/rotation/schedule';
import { renderWithToasts } from '../../src/testing/renderWithToasts';

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

/** Waits until the live capability answer has enabled the controls. */
const ready = () =>
  waitFor(() =>
    expect(
      screen.getByLabelText(t('en', 'automation.enable.label')),
    ).toBeEnabled(),
  );

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
        screen.getByLabelText(t('en', `automation.target.${target}`)),
      ).toHaveProp(
        'accessibilityState',
        expect.objectContaining({ selected: true }),
      ),
    );
    // Opening the screen is not a change, so it writes nothing.
    expect(nativeService.configureRotation).not.toHaveBeenCalled();
    expect(useAppStore.getState().wallpaperTarget).toBe(target);
  },
);

// Mutation caught: a control live before the capability answer arrives would
// save a target the device cannot set.
test('disables the controls while capability support is still loading', () => {
  nativeService.getWallpaperCapabilities.mockReturnValue(new Promise(() => {}));
  render(<AutomationScreen />);
  expect(
    screen.getByLabelText(t('en', 'automation.enable.label')),
  ).toBeDisabled();
  expect(screen.getByLabelText(t('en', 'rotation.source.all'))).toBeDisabled();
});

// Mutation caught: the screen has no Save button to validate against, so a
// tappable source with nothing saved would ask for a choice the store refuses.
test('offers favorites-only scheduling only once a favorite exists', async () => {
  render(<AutomationScreen />);
  await ready();

  expect(
    screen.getByLabelText(t('en', 'rotation.source.saved')),
  ).toBeDisabled();
  expect(
    screen.getByText(t('en', 'automation.favoritesOnly.empty')),
  ).toBeOnTheScreen();

  act(() => useAppStore.setState({ favoriteQuoteIds: ['motivation-001'] }));
  await waitFor(() =>
    expect(screen.getByLabelText(t('en', 'rotation.source.saved'))).toBeEnabled(),
  );
  expect(
    screen.queryByText(t('en', 'automation.favoritesOnly.empty')),
  ).toBeNull();

  fireEvent.press(screen.getByLabelText(t('en', 'rotation.source.saved')));
  await waitFor(() =>
    expect(useAppStore.getState().favoriteQuotesOnly).toBe(true),
  );
});

// Mutation caught: a change held in local state until a button commits it is
// the behaviour this screen replaced. Leaving the screen must not lose it.
test('saves a schedule change with no button press', async () => {
  render(<AutomationScreen />);
  await ready();

  fireEvent.press(screen.getByLabelText(t('en', 'automation.schedule.hourly')));

  await waitFor(() =>
    expect(useAppStore.getState().rotationSchedule).toBe('hourly'),
  );
  expect(nativeService.configureRotation).toHaveBeenCalledWith(
    expect.objectContaining({ intervalHours: 1 }),
  );
});

test('saves the on/off toggle and the randomize style on change', async () => {
  render(<AutomationScreen />);
  await ready();

  fireEvent.press(screen.getByLabelText(t('en', 'automation.enable.label')));
  await waitFor(() => expect(useAppStore.getState().rotationEnabled).toBe(true));

  fireEvent.press(screen.getByLabelText(t('en', 'rotation.randomize.label')));
  await waitFor(() =>
    expect(useAppStore.getState().randomizePreset).toBe(true),
  );
});

test('keeps unavailable targets disabled and saves a supported one', async () => {
  render(<AutomationScreen />);
  await ready();

  expect(
    screen.getByLabelText(t('en', 'automation.target.lock')),
  ).toBeDisabled();
  expect(
    screen.getByLabelText(t('en', 'automation.target.both')),
  ).toBeDisabled();

  fireEvent.press(screen.getByLabelText(t('en', 'automation.target.home')));
  await waitFor(() =>
    expect(useAppStore.getState().wallpaperTarget).toBe('home'),
  );
});

// Mutation caught: without the store as the single source of truth the control
// would keep showing a change that native refused, so the screen and the
// scheduled work would disagree.
test('reverts the control and reports when native scheduling rejects', async () => {
  nativeService.configureRotation.mockRejectedValueOnce({
    code: 'CONFIGURE_FAILED',
  });
  renderWithToasts(<AutomationScreen />);
  await ready();

  fireEvent.press(screen.getByLabelText(t('en', 'automation.schedule.hourly')));

  expect(
    await screen.findByText(t('en', 'automation.save.error')),
  ).toBeOnTheScreen();
  expect(useAppStore.getState().rotationSchedule).toBe('daily');
  expect(
    screen.getByLabelText(t('en', 'automation.schedule.daily')),
  ).toHaveProp('accessibilityState', expect.objectContaining({ selected: true }));
});

// Mutation caught: a toast for every tap on a screen of toggles buries the one
// change that decides whether rotation runs at all.
test('reports only the on/off toggle with a toast', async () => {
  renderWithToasts(<AutomationScreen />);
  await ready();

  fireEvent.press(screen.getByLabelText(t('en', 'automation.schedule.hourly')));
  await waitFor(() =>
    expect(useAppStore.getState().rotationSchedule).toBe('hourly'),
  );
  expect(screen.queryByText(t('en', 'automation.save.enabled'))).toBeNull();

  fireEvent.press(screen.getByLabelText(t('en', 'automation.enable.label')));
  expect(
    await screen.findByText(t('en', 'automation.save.enabled')),
  ).toBeOnTheScreen();
});

// Mutation caught: rendering a native worker code directly could expose
// implementation details instead of a recovery path.
test('maps a retryable worker failure to safe text and one retry action', async () => {
  nativeService.getRotationStatus.mockResolvedValue({
    enabled: true,
    state: 'failed',
    errorCode: 'SYSTEM_FAILED',
  });
  render(<AutomationScreen />);

  await waitFor(() =>
    expect(
      screen.getByText(t('en', 'automation.recovery.systemFailed')),
    ).toBeOnTheScreen(),
  );
  expect(screen.queryByText('Last error: SYSTEM_FAILED')).toBeNull();
  expect(
    screen.getByRole('button', { name: t('en', 'automation.recovery.retryNow.label') }),
  ).toBeOnTheScreen();
});

// Mutation caught: damaged app data is not a preference, so offering a button
// that only re-saves the same preferences repeats the failure and strands the
// reader on a card that never clears.
test('offers no action for a failure no preference can fix', async () => {
  nativeService.getRotationStatus.mockResolvedValue({
    enabled: true,
    state: 'failed',
    errorCode: 'ASSET_INVALID',
  });
  render(<AutomationScreen />);

  await waitFor(() =>
    expect(
      screen.getByText(t('en', 'automation.recovery.assetInvalid')),
    ).toBeOnTheScreen(),
  );
  expect(
    screen.queryByRole('button', {
      name: t('en', 'automation.recovery.retryNow.label'),
    }),
  ).toBeNull();
  expect(
    screen.queryByRole('button', {
      name: t('en', 'automation.recovery.reschedule.label'),
    }),
  ).toBeNull();
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
