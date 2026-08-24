import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { router } from 'expo-router';

import SettingsScreen from '../settings';
import { getAllQuotes } from '../../src/features/quotes/quoteRepository';
import { createDefaultPersistedAppState } from '../../src/store/schema';
import { useAppStore } from '../../src/store/useAppStore';
import { setRotationSynchronizer } from '../../src/store/automationSynchronization';
import { t } from '../../src/features/i18n/t';

beforeEach(() => {
  jest.mocked(router.push).mockClear();
  useAppStore.setState(createDefaultPersistedAppState());
  setRotationSynchronizer(async () => undefined);
});

test('Settings persists random preset and favorites-only choices through store actions', async () => {
  const quote = getAllQuotes()[0]!;
  useAppStore.setState({ favoriteQuoteIds: [quote.id] });
  render(<SettingsScreen />);

  fireEvent.press(screen.getByLabelText('Randomize preset'));
  await waitFor(() =>
    expect(useAppStore.getState().randomizePreset).toBe(true),
  );
  fireEvent.press(screen.getByLabelText('Use favorite quotes only'));

  await waitFor(() =>
    expect(useAppStore.getState()).toMatchObject({
      randomizePreset: true,
      favoriteQuotesOnly: true,
    }),
  );
  expect(screen.getByText('Motivana 1.0.0')).toBeOnTheScreen();
});

// Mutation caught: reading a hard-coded English string would leave the interface English after the reader picks Vietnamese.
test('renders the interface in the stored app language', async () => {
  useAppStore.setState({ appLocale: 'vi' });

  render(<SettingsScreen />);

  expect(await screen.findByText(t('vi', 'settings.title'))).toBeTruthy();
});

// Mutation caught: wiring both pickers to one action would change the quote language when the reader only wanted a Vietnamese interface.
test('changes the interface language without changing the quote language', async () => {
  render(<SettingsScreen />);

  fireEvent.press(screen.getAllByLabelText('Tiếng Việt')[0]!);

  await waitFor(() => expect(useAppStore.getState().appLocale).toBe('vi'));
  expect(useAppStore.getState().contentLocale).toBe('en');
});

// Mutation caught: wiring the quote-language picker through the interface-language setter would flip appLocale even though there is no Vietnamese quote content to switch into.
test('attempting to change the quote language leaves the interface language untouched', async () => {
  render(<SettingsScreen />);

  fireEvent.press(screen.getAllByLabelText('Tiếng Việt')[1]!);

  await waitFor(() =>
    expect(
      screen.getByText('Could not update the language. Try again.'),
    ).toBeOnTheScreen(),
  );
  expect(useAppStore.getState().contentLocale).toBe('en');
  expect(useAppStore.getState().appLocale).toBe('en');
});

test('Settings names the current preset and exposes one accessible control per setting', () => {
  render(<SettingsScreen />);

  expect(screen.getByText('Midnight Focus')).toBeOnTheScreen();
  expect(
    screen.getAllByRole('switch', { name: 'Randomize preset' }),
  ).toHaveLength(1);
  expect(
    screen.getByLabelText('Randomize preset').props.accessibilityHint,
  ).toContain('different curated style');

  fireEvent.press(screen.getByRole('button', { name: 'Customize preset' }));
  expect(router.push).toHaveBeenCalledWith('/customize');
});

// Mutation caught: reverting a switch after native rejection without notice makes the rotation snapshot failure indistinguishable from an ignored tap.
test('Settings shows a safe retry when random-preset synchronization fails', async () => {
  let attempts = 0;
  setRotationSynchronizer(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('native secret');
  });
  useAppStore.setState({ rotationEnabled: true });
  render(<SettingsScreen />);

  fireEvent.press(screen.getByLabelText('Randomize preset'));
  await waitFor(() =>
    expect(
      screen.getByText('Could not update rotation preferences. Try again.'),
    ).toBeOnTheScreen(),
  );
  expect(screen.queryByText('native secret')).toBeNull();
  fireEvent.press(
    screen.getByRole('button', { name: 'Retry preference update' }),
  );

  await waitFor(() =>
    expect(
      screen.getByText('Random preset preference updated.'),
    ).toBeOnTheScreen(),
  );
  expect(attempts).toBe(2);
});
