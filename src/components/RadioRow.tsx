import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface RadioRowProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
}

/** The bordered radio row the rotation screen uses to pick a quote source. */
export function RadioRow({
  label,
  selected,
  onPress,
  disabled = false,
  accessibilityHint,
}: RadioRowProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.row,
        selected && styles.selected,
        disabled && styles.disabled,
      ]}
    >
      <View style={[styles.dot, selected && styles.dotOn]} />
      <Text allowFontScaling style={[styles.label, selected && styles.labelOn]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderColor: colors.borderSubtle,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.x1 + 3,
    minHeight: spacing.control,
    paddingHorizontal: 13,
  },
  selected: { borderColor: 'rgba(232, 180, 76, 0.6)' },
  disabled: { opacity: 0.4 },
  dot: {
    borderColor: colors.faintText,
    borderRadius: spacing.pill,
    borderWidth: 1,
    height: 16,
    width: 16,
  },
  dotOn: {
    backgroundColor: colors.background,
    borderColor: colors.accent,
    borderWidth: 4,
  },
  label: { ...typography.rowLabel, color: colors.mutedText, fontSize: 13 },
  labelOn: { color: colors.text },
});
