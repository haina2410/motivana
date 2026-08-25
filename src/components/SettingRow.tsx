import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

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
        <Text
          allowFontScaling={false}
          style={[styles.indicatorText, value && styles.indicatorTextOn]}
        >
          {value ? 'On' : 'Off'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.x2,
    justifyContent: 'space-between',
    minHeight: spacing.control,
    paddingVertical: 10,
  },
  copy: { flex: 1, gap: 5 },
  disabled: { opacity: 0.4 },
  label: typography.rowLabel,
  description: { ...typography.caption, fontSize: 11, lineHeight: 16 },
  indicator: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: spacing.pill,
    justifyContent: 'center',
    minWidth: 46,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  indicatorOn: { backgroundColor: colors.accent },
  indicatorText: { ...typography.tab, color: colors.text, fontSize: 11 },
  indicatorTextOn: { color: colors.onAccent },
});
