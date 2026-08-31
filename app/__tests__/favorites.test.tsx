import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import FavoritesScreen from '../(tabs)/favorites';
import {
  favoriteQuoteText,
  getAllQuotes,
} from '../../src/features/quotes/quoteRepository';
import { createDefaultPersistedAppState } from '../../src/store/schema';
import { useAppStore } from '../../src/store/useAppStore';
import { t } from '../../src/features/i18n/t';
import { renderWithToasts } from '../../src/testing/renderWithToasts';

beforeEach(() => {
  jest.mocked(router.navigate).mockClear();
  useAppStore.setState(createDefaultPersistedAppState());
});

test('Favorites explains how to add the first quote when empty', () => {
  renderWithToasts(<FavoritesScreen />);
  expect(
    screen.getByText(t('en', 'favorites.empty.message')),
  ).toBeOnTheScreen();
});

test('selecting a saved wallpaper persists its quote and returns to the deck', () => {
  const quote = getAllQuotes()[4]!;
  useAppStore.setState({ favoriteQuoteIds: [quote.id] });
  renderWithToasts(<FavoritesScreen />);

  const text = favoriteQuoteText(quote, useAppStore.getState().contentLocale);
  fireEvent.press(
    screen.getByLabelText(t('en', 'favorites.item.label', { text })),
  );
  expect(useAppStore.getState().currentQuoteId).toBe(quote.id);
  expect(router.navigate).toHaveBeenCalledWith('/');
});

test('removing a saved quote drops it from the list and says so', async () => {
  const quote = getAllQuotes()[4]!;
  useAppStore.setState({ favoriteQuoteIds: [quote.id] });
  renderWithToasts(<FavoritesScreen />);

  const text = favoriteQuoteText(quote, useAppStore.getState().contentLocale);
  fireEvent.press(
    screen.getByLabelText(t('en', 'favorites.remove.label', { text })),
  );

  await waitFor(() =>
    expect(useAppStore.getState().favoriteQuoteIds).toEqual([]),
  );
  expect(screen.getByText(t('en', 'favorites.removed'))).toBeOnTheScreen();
  expect(
    screen.getByText(t('en', 'favorites.empty.message')),
  ).toBeOnTheScreen();
});

test('keeps the last saved quote when rotation reads saved quotes only', async () => {
  const quote = getAllQuotes()[4]!;
  useAppStore.setState({
    favoriteQuoteIds: [quote.id],
    favoriteQuotesOnly: true,
  });
  renderWithToasts(<FavoritesScreen />);

  const text = favoriteQuoteText(quote, useAppStore.getState().contentLocale);
  fireEvent.press(
    screen.getByLabelText(t('en', 'favorites.remove.label', { text })),
  );

  expect(
    await screen.findByText(t('en', 'favorites.remove.error')),
  ).toBeOnTheScreen();
  expect(useAppStore.getState().favoriteQuoteIds).toEqual([quote.id]);
});
