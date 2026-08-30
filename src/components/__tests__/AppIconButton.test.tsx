import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { AppIconButton } from '../AppIconButton';

// Mutation caught: a rail circle at the 36pt header size falls under the 44pt minimum touch target.
test('the glass variant is a 46pt circle', () => {
  render(
    <AppIconButton
      icon="heart"
      label="Save"
      hint="Saves this quote."
      onPress={() => undefined}
      variant="glass"
    />,
  );

  const style = StyleSheet.flatten(
    screen.getByLabelText('Save').props.style,
  ) as { height?: number; width?: number };
  expect(style.height).toBe(46);
  expect(style.width).toBe(46);
});

// Mutation caught: firing onPress while disabled would apply a wallpaper the deck has not finished rendering.
test('a disabled button does not fire', () => {
  const onPress = jest.fn();
  render(
    <AppIconButton
      disabled
      icon="heart"
      label="Save"
      hint="Saves this quote."
      onPress={onPress}
      variant="glass"
    />,
  );

  fireEvent.press(screen.getByLabelText('Save'));

  expect(onPress).not.toHaveBeenCalled();
});
