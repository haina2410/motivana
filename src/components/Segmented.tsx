import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { Icon, type IconName } from './Icon';

export interface SegmentedOption<Value extends string | number> {
  value: Value;
  label: string;
  icon?: IconName;
  accessibilityLabel?: string;
  disabled?: boolean;
}

interface SegmentedProps<Value extends string | number> {
  options: readonly SegmentedOption<Value>[];
  selected: Value;
  onSelect?: (value: Value) => void;
  /** A read-only segmented control still shows which segment is active. */
  readOnly?: boolean;
}

/** The inset segmented control from the board: 6h / 12h / 24h, or alignment. */
export function Segmented<Value extends string | number>({
  options,
  selected,
  onSelect,
  readOnly = false,
}: SegmentedProps<Value>) {
  return (
    <View style={styles.track}>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            accessibilityRole={readOnly ? 'text' : 'button'}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{
              selected: active,
              disabled: readOnly || option.disabled,
            }}
            disabled={readOnly || option.disabled}
            key={String(option.value)}
            onPress={() => onSelect?.(option.value)}
            style={[
              styles.segment,
              active && styles.active,
              option.disabled && styles.disabled,
            ]}
          >
            {option.icon ? (
              <Icon
                name={option.icon}
                size={13}
                color={active ? colors.onAccent : colors.mutedText}
              />
            ) : (
              <Text
                allowFontScaling
                style={[styles.label, active && styles.activeLabel]}
              >
                {option.label}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 10,
    flexDirection: 'row',
    padding: 3,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 7,
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
  },
  active: { backgroundColor: colors.accent },
  disabled: { opacity: 0.4 },
  label: { ...typography.chip, color: colors.mutedText },
  activeLabel: { color: colors.onAccent, fontFamily: fonts.semibold },
});
