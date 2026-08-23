import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface SettingRowProps {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export function SettingRow({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
}: SettingRowProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[styles.row, disabled && styles.disabled]}
    >
      <View style={styles.copy}>
        <Text allowFontScaling style={styles.label}>
          {label}
        </Text>
        <Text allowFontScaling style={styles.description}>
          {description}
        </Text>
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[styles.indicator, value && styles.indicatorOn]}
      >
        <Text allowFontScaling={false} style={styles.indicatorText}>
          {value ? 'On' : 'Off'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: spacing.radius,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.x2,
    justifyContent: 'space-between',
    minHeight: spacing.control * 1.5,
    padding: spacing.x2,
  },
  copy: { flex: 1, gap: 4 },
  disabled: { opacity: 0.48 },
  label: { color: colors.text, fontSize: 16, fontWeight: '700' },
  description: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  indicator: {
    alignItems: 'center',
    backgroundColor: colors.border,
    borderRadius: spacing.radius,
    justifyContent: 'center',
    minWidth: 46,
    paddingHorizontal: spacing.x1,
    paddingVertical: 6,
  },
  indicatorOn: { backgroundColor: colors.accent },
  indicatorText: { color: colors.text, fontSize: 12, fontWeight: '800' },
});
