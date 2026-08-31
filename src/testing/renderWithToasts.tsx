import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { View } from 'react-native';

import { ToastHost } from '../components/ToastHost';
import { useToastStore } from '../store/useToastStore';

/**
 * Renders a screen the way the app does, with the toast host above it, so a
 * test can read the result message a screen raises. The app mounts the host in
 * the root layout, which a screen test never reaches.
 */
export function renderWithToasts(ui: ReactElement) {
  useToastStore.setState({ toast: undefined });
  // A host view, not a fragment: the app roots this pair in
  // GestureHandlerRootView, and a fragment leaves the tree with two roots,
  // which the press helpers walk off the top of.
  return render(
    <View>
      {ui}
      <ToastHost />
    </View>,
  );
}
