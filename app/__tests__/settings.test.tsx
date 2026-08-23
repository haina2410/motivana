import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import SettingsScreen from '../settings';
import { getAllQuotes } from '../../src/features/quotes/quoteRepository';
import { createDefaultPersistedAppState } from '../../src/store/schema';
import { useAppStore } from '../../src/store/useAppStore';

beforeEach(() => {
  jest.mocked(router.push).mockClear();
  useAppStore.setState(createDefaultPersistedAppState());
});

test('Settings persists random preset and favorites-only choices through store actions', () => {
  const quote = getAllQuotes()[0]!;
  useAppStore.setState({ favoriteQuoteIds: [quote.id] });
  render(<SettingsScreen />);

  fireEvent.press(screen.getByLabelText('Randomize preset'));
  fireEvent.press(screen.getByLabelText('Use favorite quotes only'));

  expect(useAppStore.getState().randomizePreset).toBe(true);
  expect(useAppStore.getState().favoriteQuotesOnly).toBe(true);
  expect(screen.getByText('Motivana 1.0.0')).toBeOnTheScreen();
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
