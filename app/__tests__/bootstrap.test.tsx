import { render, screen } from '@testing-library/react-native';
import HomeScreen from '../index';

test('renders the product name and loading preview state', () => {
  render(<HomeScreen />);

  expect(screen.getByText('Motivana')).toBeOnTheScreen();
  expect(screen.getByLabelText('Wallpaper preview')).toBeOnTheScreen();
});
