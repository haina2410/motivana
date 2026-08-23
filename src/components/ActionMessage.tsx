import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface ActionMessageProps {
  title?: string;
  message: string;
  tone?: 'default' | 'error';
}

export function ActionMessage({
  title,
  message,
  tone = 'default',
}: ActionMessageProps) {
  return (
    <View
      accessibilityRole="alert"
      style={[styles.container, tone === 'error' && styles.error]}
    >
      {title ? (
        <Text allowFontScaling style={styles.title}>
          {title}
        </Text>
      ) : null}
      {message.split('\n').map((line) => (
        <Text allowFontScaling key={line} style={styles.message}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: spacing.radius,
    borderWidth: 1,
    gap: 4,
    padding: spacing.x2,
  },
  error: { borderColor: colors.danger },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  message: { color: colors.mutedText, fontSize: 14, lineHeight: 20 },
});
