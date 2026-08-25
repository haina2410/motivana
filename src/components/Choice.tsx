import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export function Choice({
  label,
  accessibilityLabel,
  selected,
  disabled = false,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choice,
        selected && styles.selected,
        disabled && styles.disabled,
      ]}
    >
      <Text
        allowFontScaling
        style={[styles.choiceText, selected && styles.selectedText]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  choice: {
    backgroundColor: colors.fill,
    borderRadius: spacing.pill,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 16,
  },
  selected: { backgroundColor: colors.accent },
  disabled: { opacity: 0.4 },
  choiceText: { ...typography.chip, color: colors.mutedText },
  selectedText: { color: colors.onAccent },
});
