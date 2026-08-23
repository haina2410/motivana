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
}));

beforeEach(() => {
  useAppStore.setState(createDefaultPersistedAppState());
});

test('Automation validates favorites-only scheduling while clearly reporting unavailable native status', async () => {
  render(<AutomationScreen />);

  await waitFor(() =>
    expect(screen.getByText('Capability: live')).toBeOnTheScreen(),
  );

  expect(screen.getByText('Wallpaper targets available')).toBeOnTheScreen();
  expect(screen.getByText('Capability: live')).toBeOnTheScreen();
  expect(screen.getByText('Status: unavailable')).toBeOnTheScreen();
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
    expect(screen.getByText('Capability: live')).toBeOnTheScreen(),
  );
  fireEvent.press(screen.getByLabelText('Every 6 hours'));
  fireEvent.press(screen.getByLabelText('Apply to both screens'));
  fireEvent.press(screen.getByLabelText('Apply to Lock screen'));

  expect(screen.getByLabelText('Apply to Lock screen')).toBeDisabled();
  expect(screen.getByLabelText('Apply to both screens')).toBeDisabled();
  fireEvent.press(
    screen.getByRole('button', { name: 'Save automation preferences' }),
  );

  expect(useAppStore.getState().rotationIntervalHours).toBe(6);
  expect(useAppStore.getState().wallpaperTarget).toBe('home');
  expect(useAppStore.getState().rotationEnabled).toBe(false);
});
