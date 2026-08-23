import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import AutomationScreen from '../automation';
import { createDefaultPersistedAppState } from '../../src/store/schema';
import { useAppStore } from '../../src/store/useAppStore';

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
};

beforeEach(() => {
  useAppStore.setState(createDefaultPersistedAppState());
  nativeService.getWallpaperCapabilities.mockResolvedValue({
    supportsHome: true,
    supportsLock: false,
  });
  nativeService.configureRotation.mockResolvedValue(undefined);
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
      expect(screen.getByText('Capability: available')).toBeOnTheScreen(),
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Save automation preferences' }),
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
    screen.getByRole('button', { name: 'Save automation preferences' }),
  ).toBeDisabled();
  expect(screen.getByText('Capability: loading')).toBeOnTheScreen();
});

test('Automation validates favorites-only scheduling while clearly reporting unavailable native status', async () => {
  render(<AutomationScreen />);

  await waitFor(() =>
    expect(screen.getByText('Capability: available')).toBeOnTheScreen(),
  );

  expect(screen.getByText('Wallpaper targets available')).toBeOnTheScreen();
  expect(screen.getByText('Capability: available')).toBeOnTheScreen();
  expect(screen.getByText('Status: disabled')).toBeOnTheScreen();
  fireEvent.press(screen.getByLabelText('Use favorite quotes only'));
  fireEvent.press(
    screen.getByRole('button', { name: 'Save automation preferences' }),
  );

  expect(
    screen.getByText('Add a favorite before using favorites-only rotation.'),
  ).toBeOnTheScreen();
  expect(useAppStore.getState().rotationEnabled).toBe(false);
});

test('Automation stores supported preferences and keeps unavailable targets disabled', async () => {
  render(<AutomationScreen />);
  await waitFor(() =>
    expect(screen.getByText('Capability: available')).toBeOnTheScreen(),
  );
  fireEvent.press(screen.getByLabelText('Every 6 hours'));
  fireEvent.press(screen.getByLabelText('Apply to both screens'));
  fireEvent.press(screen.getByLabelText('Apply to Lock screen'));

  expect(screen.getByLabelText('Apply to Lock screen')).toBeDisabled();
  expect(screen.getByLabelText('Apply to both screens')).toBeDisabled();
  fireEvent.press(
    screen.getByRole('button', { name: 'Save automation preferences' }),
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
    expect(screen.getByText('Capability: available')).toBeOnTheScreen(),
  );
  fireEvent.press(screen.getByLabelText('Every 6 hours'));
  fireEvent.press(
    screen.getByRole('button', { name: 'Save automation preferences' }),
  );
  await waitFor(() =>
    expect(nativeService.configureRotation).toHaveBeenCalledWith(
      expect.objectContaining({ intervalHours: 6 }),
    ),
  );
  expect(useAppStore.getState().rotationIntervalHours).toBe(24);
});
