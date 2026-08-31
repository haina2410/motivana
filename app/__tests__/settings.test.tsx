import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import appJson from '../../app.json';
import SettingsScreen from '../settings';
import { createDefaultPersistedAppState } from '../../src/store/schema';
import { useAppStore } from '../../src/store/useAppStore';
import { setRotationSynchronizer } from '../../src/store/automationSynchronization';
import { t } from '../../src/features/i18n/t';

beforeEach(() => {
  jest.mocked(router.push).mockClear();
  jest.mocked(router.navigate).mockClear();
  useAppStore.setState(createDefaultPersistedAppState());
  setRotationSynchronizer(async () => undefined);
});

// Mutation caught: inlining the rotation controls here would offer the same
// preference on two screens with two save behaviours; the row has to open the
// rotation screen instead of standing in for it.
test('opens the rotation screen from the settings row', () => {
  render(<SettingsScreen />);

  fireEvent.press(screen.getByLabelText(t('en', 'settings.rotation.label')));

  expect(router.navigate).toHaveBeenCalledWith('/automation');
});

// Mutation caught: a fixed value would report rotation as off while it runs.
test('reports whether rotation is on', () => {
  useAppStore.setState({ rotationEnabled: true });

  render(<SettingsScreen />);

  expect(screen.getByText(t('en', 'settings.rotation.on'))).toBeOnTheScreen();
});

// Mutation caught: leaving a rotation control here would offer the same
// preference twice, once per screen, with two different save behaviours.
test('Settings leaves every rotation preference to the rotation screen', () => {
  render(<SettingsScreen />);

  expect(screen.queryByLabelText('Randomize preset')).toBeNull();
  expect(screen.queryByLabelText('Use favorite quotes only')).toBeNull();
});

// Mutation caught: a hand-written version literal here and in the screen agree
// with each other while both disagree with app.json, which is what shipped
// 0.1.0 on a 0.2.0 build. app.json is the only honest oracle.
test('shows the version app.json declares, not a copy of it', () => {
  render(<SettingsScreen />);

  expect(screen.getByText(appJson.expo.version)).toBeOnTheScreen();
});

// Mutation caught: dropping these rows leaves no way to tell, from a device in
// someone's hand, whether an over-the-air update actually landed.
test('names the bundle and the runtime this install is running', () => {
  render(<SettingsScreen />);

  expect(screen.getByText(t('en', 'settings.update.label'))).toBeOnTheScreen();
  expect(screen.getByText(t('en', 'settings.runtime.label'))).toBeOnTheScreen();
});

// Mutation caught: reading a hard-coded English string would leave the interface English after the reader picks Vietnamese.
test('renders the interface in the stored app language', async () => {
  useAppStore.setState({ appLocale: 'vi' });

  render(<SettingsScreen />);

  expect(await screen.findByText(t('vi', 'settings.title'))).toBeTruthy();
});

// Mutation caught: wiring both pickers to one action would change the quote language when the reader only wanted a Vietnamese interface.
test('changes the interface language without changing the quote language', async () => {
  useAppStore.setState({ contentLocale: 'en' });
  render(<SettingsScreen />);

  fireEvent.press(screen.getByLabelText('Interface language: Tiếng Việt'));

  await waitFor(() => expect(useAppStore.getState().appLocale).toBe('vi'));
  expect(useAppStore.getState().contentLocale).toBe('en');
});

// Mutation caught: wiring the quote-language picker through the interface-language setter would flip appLocale when the reader only wanted a Vietnamese quote language.
test('changes the quote language without changing the interface language', async () => {
  render(<SettingsScreen />);

  fireEvent.press(screen.getByLabelText('Quote language: Tiếng Việt'));

  await waitFor(() => expect(useAppStore.getState().contentLocale).toBe('vi'));
  expect(useAppStore.getState().appLocale).toBe('en');
});

test('Settings exposes one control per setting', () => {
  render(<SettingsScreen />);

  expect(
    screen.getAllByRole('switch', {
      name: t('en', 'settings.saveToLibrary.label'),
    }),
  ).toHaveLength(1);
  expect(
    screen.getByLabelText(t('en', 'settings.saveToLibrary.label')).props
      .accessibilityHint,
  ).toContain('keeps a copy in your photos');
});

// Android 10 has no working save path: the modern MediaStore insert starts at
// API 30, and the legacy file copy is blocked by the scoped storage this app's
// target SDK enforces. Offering the switch there would only promise a failure.
test.each([
  [28, true],
  [29, false],
  [30, true],
  [36, true],
])('offers the photo-library switch on API %s: %s', (version, offered) => {
  const original = Object.getOwnPropertyDescriptor(Platform, 'Version');
  Object.defineProperty(Platform, 'Version', {
    configurable: true,
    value: version,
  });
  try {
    render(<SettingsScreen />);

    const toggle = screen.queryByLabelText(
      t('en', 'settings.saveToLibrary.label'),
    );
    if (offered) expect(toggle).toBeOnTheScreen();
    else expect(toggle).toBeNull();
  } finally {
    if (original) Object.defineProperty(Platform, 'Version', original);
  }
});

// Mutation caught: a settings switch that only moves locally would leave the
// preview and the applied wallpaper disagreeing after a restart.
test('Settings persists the two preview and export options', () => {
  render(<SettingsScreen />);

  fireEvent.press(
    screen.getByLabelText(t('en', 'settings.saveToLibrary.label')),
  );
  expect(useAppStore.getState().saveToPhotoLibrary).toBe(true);
  expect(
    screen.getByText(t('en', 'settings.saveToLibrary.updated')),
  ).toBeOnTheScreen();

  fireEvent.press(screen.getByLabelText(t('en', 'settings.safeGuides.label')));
  expect(useAppStore.getState().showSafeGuides).toBe(true);
});

// Mutation caught: listing only the catalogue locales would leave the reader no way to ask for every language, and would offer "All languages" as an interface language.
test('offers every language for the quotes only', async () => {
  render(<SettingsScreen />);

  expect(
    screen.queryByLabelText('Interface language: All languages'),
  ).toBeNull();
  fireEvent.press(screen.getByLabelText('Quote language: All languages'));

  await waitFor(() => expect(useAppStore.getState().contentLocale).toBe('all'));
  expect(useAppStore.getState().appLocale).toBe('en');
});
