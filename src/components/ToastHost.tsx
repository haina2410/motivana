import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToastStore } from '../store/useToastStore';
import { spacing } from '../theme/spacing';
import { ActionMessage } from './ActionMessage';

/** Milliseconds a result message stays readable before it leaves on its own. */
const TOAST_DURATION = 4000;

/**
 * Shows the one result message the app has to report, over whichever screen is
 * on top. It sits above the navigator, so a message survives the screen that
 * raised it, and it holds the top of the display rather than the bottom, where
 * the deck tab bar and the home controls already are.
 */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const toast = useToastStore((state) => state.toast);
  const hideToast = useToastStore((state) => state.hideToast);

  // Keyed on the id, so replacing a message restarts the clock instead of
  // letting the message it replaced end them both.
  useEffect(() => {
    if (!toast) return;
    const id = toast.id;
    const timer = setTimeout(() => hideToast(id), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [hideToast, toast]);

  if (!toast) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingTop: insets.top + spacing.x1 }]}
    >
      <ActionMessage message={toast.message} tone={toast.tone} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    left: 0,
    paddingHorizontal: spacing.x2,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
