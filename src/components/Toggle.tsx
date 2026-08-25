import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface ToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

/** The amber pill switch the board uses for rotation and the export options. */
export function Toggle({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
}: ToggleProps) {
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
        <Text allowFontScaling style={typography.rowLabel}>
          {label}
        </Text>
        {description ? (
          <Text allowFontScaling style={styles.description}>
            {description}
          </Text>
        ) : null}
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[styles.track, value && styles.trackOn]}
      >
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.x2,
    justifyContent: 'space-between',
    minHeight: spacing.control,
    paddingVertical: 6,
  },
  copy: { flex: 1, gap: 5 },
  description: { ...typography.caption, fontSize: 11, lineHeight: 16 },
  disabled: { opacity: 0.4 },
  track: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: spacing.pill,
    height: 24,
    justifyContent: 'center',
    width: 42,
  },
  trackOn: { backgroundColor: colors.accent },
  knob: {
    backgroundColor: colors.text,
    borderRadius: spacing.pill,
    height: 18,
    marginLeft: 3,
    width: 18,
  },
  knobOn: {
    backgroundColor: colors.onAccent,
    marginLeft: 0,
    marginRight: 3,
    alignSelf: 'flex-end',
  },
});
