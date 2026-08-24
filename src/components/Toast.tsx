import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../theme/spacing';
import { ActionMessage } from './ActionMessage';

interface ToastProps {
  message: string;
  tone?: 'default' | 'error';
  /** Milliseconds before the toast hides itself. Use 0 to keep it visible. */
  duration?: number;
  onDismiss?: () => void;
}

/**
 * Shows a message above its parent without taking layout space, so the
 * controls below it stay in place.
 */
export function Toast({
  message,
  tone = 'default',
  duration = 4000,
  onDismiss,
}: ToastProps) {
  useEffect(() => {
    if (!onDismiss || duration <= 0) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, message, onDismiss]);

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <ActionMessage message={message} tone={tone} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    bottom: '100%',
    left: 0,
    marginBottom: spacing.x1,
    position: 'absolute',
    right: 0,
  },
});
