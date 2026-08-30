import { fireEvent, render, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { DeckTabBar } from '../DeckTabBar';
import { t } from '../../features/i18n/t';

const routeNames = ['index', 'customize', 'favorites', 'automation'];

/**
 * The navigator hands the bar its own state. Only the parts the bar reads are
 * built here: the route names, which one is current, and navigate.
 */
function renderBar(index: number) {
  const navigate = jest.fn();
  // The bar reads `state.routes`, `state.index` and `navigation.navigate` only.
  // Building the rest of a real tab navigator's props would add nothing to the
  // assertions, so the cast stands in for them.
  const props = {
    state: { index, routes: routeNames.map((name) => ({ key: name, name })) },
    navigation: { navigate },
  } as unknown as BottomTabBarProps;
  render(<DeckTabBar {...props} />);
  return navigate;
}

test('marks the current route as the selected tab', () => {
  renderBar(2);

  expect(
    screen.getByRole('tab', { name: t('en', 'tab.saved') }).props
      .accessibilityState,
  ).toEqual({ selected: true });
  expect(
    screen.getByRole('tab', { name: t('en', 'tab.deck') }).props
      .accessibilityState,
  ).toEqual({ selected: false });
});

test('jumps to a tab by route name and ignores the current one', () => {
  const navigate = renderBar(0);

  fireEvent.press(screen.getByRole('tab', { name: t('en', 'tab.presets') }));
  fireEvent.press(screen.getByRole('tab', { name: t('en', 'tab.saved') }));
  fireEvent.press(screen.getByRole('tab', { name: t('en', 'tab.rotate') }));
  expect(navigate.mock.calls).toEqual([
    ['customize'],
    ['favorites'],
    ['automation'],
  ]);

  // Re-tapping the open tab would push the reader nowhere, so it does nothing.
  fireEvent.press(screen.getByRole('tab', { name: t('en', 'tab.deck') }));
  expect(navigate).toHaveBeenCalledTimes(3);
});
