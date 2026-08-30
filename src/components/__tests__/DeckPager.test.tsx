import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DeckPager } from '../DeckPager';

function renderPager(overrides: Partial<Parameters<typeof DeckPager>[0]> = {}) {
  const onNext = jest.fn().mockResolvedValue(true);
  const onPrevious = jest.fn().mockResolvedValue(true);
  render(
    <DeckPager
      contentKey="quote-1:preset-1"
      onNext={onNext}
      onPrevious={onPrevious}
      nextLabel="Next wallpaper"
      nextHint="Swipe up for a new quote and style."
      previousLabel="Previous wallpaper"
      previousHint="Swipe down to go back."
      next={<Text>next card</Text>}
      previous={<Text>previous card</Text>}
      {...overrides}
    >
      <Text>current card</Text>
    </DeckPager>,
  );
  return { onNext, onPrevious };
}

// Mutation caught: rendering only the current card makes the drag reveal empty space, so the swipe reads as a state swap rather than a deck.
test('keeps the neighbouring cards mounted so a drag reveals them', () => {
  renderPager();

  expect(screen.getByText('current card')).toBeOnTheScreen();
  expect(screen.getByText('next card')).toBeOnTheScreen();
  expect(screen.getByText('previous card')).toBeOnTheScreen();
});

// Mutation caught: a swipe is invisible to a screen reader, so without explicit actions the deck cannot be advanced at all.
test('exposes both directions as accessibility actions', () => {
  const { onNext, onPrevious } = renderPager();

  const deck = screen.getByLabelText('Next wallpaper');
  fireEvent(deck, 'accessibilityAction', {
    nativeEvent: { actionName: 'activate' },
  });
  expect(onNext).toHaveBeenCalledTimes(1);

  fireEvent(deck, 'accessibilityAction', {
    nativeEvent: { actionName: 'previous' },
  });
  expect(onPrevious).toHaveBeenCalledTimes(1);
});

// The drag clamp that keeps a missing neighbour from opening a void (no
// `next`/`previous` prop -> offset stays pinned at 0) lives inside the Pan
// gesture's worklet callbacks. jestSetup's gesture-handler mock does not run
// a real pan and cannot dispatch changeY events into those callbacks, and
// the offset itself is an unread Reanimated shared value, so there is no
// RNTL-observable effect to assert on here. The clamp is exercised by the
// human visual check this branch's other changes call for instead.

// Mutation caught: an else that runs for any unrecognised action name moves the
// reader forward on a VoiceOver escape or a magic tap.
test('ignores an accessibility action it does not name', () => {
  const { onNext, onPrevious } = renderPager();

  const deck = screen.getByLabelText('Next wallpaper');
  fireEvent(deck, 'accessibilityAction', {
    nativeEvent: { actionName: 'escape' },
  });
  fireEvent(deck, 'accessibilityAction', {
    nativeEvent: { actionName: 'magicTap' },
  });

  expect(onNext).not.toHaveBeenCalled();
  expect(onPrevious).not.toHaveBeenCalled();
});
