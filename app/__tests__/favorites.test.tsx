import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import FavoritesScreen from '../favorites';
import { getAllQuotes } from '../../src/features/quotes/quoteRepository';
import { createDefaultPersistedAppState } from '../../src/store/schema';
import { useAppStore } from '../../src/store/useAppStore';

beforeEach(() => {
  jest.mocked(router.back).mockClear();
  useAppStore.setState(createDefaultPersistedAppState());
});

test('Favorites explains how to add the first quote when empty', () => {
  render(<FavoritesScreen />);
  expect(
    screen.getByText('Favorite a quote from Home to use it here.'),
  ).toBeOnTheScreen();
});

test('selecting a favorite persists it and returns Home', () => {
  const quote = getAllQuotes()[4]!;
  useAppStore.setState({ favoriteQuoteIds: [quote.id] });
  render(<FavoritesScreen />);

  fireEvent.press(screen.getByLabelText(`Use ${quote.text}`));
  expect(useAppStore.getState().currentQuoteId).toBe(quote.id);
  expect(router.back).toHaveBeenCalledTimes(1);
});
