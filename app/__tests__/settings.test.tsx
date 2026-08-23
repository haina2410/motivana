import { fireEvent, render, screen } from '@testing-library/react-native';

import SettingsScreen from '../settings';
import { getAllQuotes } from '../../src/features/quotes/quoteRepository';
import { createDefaultPersistedAppState } from '../../src/store/schema';
import { useAppStore } from '../../src/store/useAppStore';

beforeEach(() => {
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
