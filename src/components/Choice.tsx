import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export function Choice({
  label,
  selected,
  disabled = false,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choice,
        selected && styles.selected,
        disabled && styles.disabled,
      ]}
    >
      <Text allowFontScaling style={styles.choiceText}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  choice: {
    borderColor: colors.border,
    borderRadius: spacing.radius,
    borderWidth: 1,
    minHeight: spacing.control,
    paddingHorizontal: spacing.x2,
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.accent,
  },
  disabled: { opacity: 0.48 },
  choiceText: { color: colors.text, fontSize: 14, fontWeight: '700' },
});
