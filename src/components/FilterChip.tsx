import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface FilterChipProps {
  label: string;
  /** How many wallpapers the filter holds, shown beside the label. */
  count: number;
  selected: boolean;
  accessibilityHint?: string;
  onPress: () => void;
}

/**
 * One filter in the row above the wallpaper grid. `Chip` is a display-only
 * status pill, so this is a separate pressable rather than a variant of it.
 */
export function FilterChip({
  label,
  count,
  selected,
  accessibilityHint,
  onPress,
}: FilterChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text
        allowFontScaling
        numberOfLines={1}
        style={[typography.chip, selected && styles.labelSelected]}
      >
        {label}
      </Text>
      <View style={[styles.count, selected && styles.countSelected]}>
        <Text allowFontScaling style={styles.countText}>
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderColor: 'transparent',
    borderRadius: spacing.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 12,
  },
  chipSelected: {
    backgroundColor: colors.accentWash,
    borderColor: colors.accent,
  },
  labelSelected: { color: colors.text },
  count: {
    alignItems: 'center',
    backgroundColor: colors.fillSubtle,
    borderRadius: spacing.pill,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 5,
  },
  countSelected: { backgroundColor: colors.accentBorder },
  countText: { ...typography.caption, color: colors.faintText, fontSize: 11 },
});
