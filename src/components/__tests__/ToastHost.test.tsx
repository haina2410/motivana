import { act, render, screen } from '@testing-library/react-native';

import { ToastHost } from '../ToastHost';
import { useToastStore } from '../../store/useToastStore';

beforeEach(() => {
  jest.useFakeTimers();
  useToastStore.setState({ toast: undefined });
});

afterEach(() => {
  jest.useRealTimers();
});

test('shows nothing while no screen has raised a toast', () => {
  render(<ToastHost />);

  expect(screen.queryByRole('alert')).toBeNull();
});

test('shows the message a screen raised', () => {
  render(<ToastHost />);

  act(() => useToastStore.getState().showToast('Saved'));

  expect(screen.getByText('Saved')).toBeOnTheScreen();
});

// Mutation caught: a host that never times out leaves the message over the
// wallpaper for the rest of the session.
test('hides the message once its time is up', () => {
  render(<ToastHost />);
  act(() => useToastStore.getState().showToast('Saved'));

  act(() => jest.advanceTimersByTime(4000));

  expect(screen.queryByText('Saved')).toBeNull();
});

// Mutation caught: a timer keyed on nothing but mount time dismisses the
// second result when the first one's clock runs out.
test('gives a replacing message its own full time on screen', () => {
  render(<ToastHost />);
  act(() => useToastStore.getState().showToast('First'));

  act(() => jest.advanceTimersByTime(3000));
  act(() => useToastStore.getState().showToast('Second'));
  act(() => jest.advanceTimersByTime(3000));

  expect(screen.getByText('Second')).toBeOnTheScreen();
});
