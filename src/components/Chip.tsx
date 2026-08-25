import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Icon, type IconName } from './Icon';

interface ChipProps {
  label: string;
  icon?: IconName;
  /** A colour swatch instead of an icon, for the active preset. */
  swatch?: string;
}

/** The translucent status pills under the deck card: preset name and typeface. */
export function Chip({ label, icon, swatch }: ChipProps) {
  return (
    <View style={styles.chip}>
      {swatch ? (
        <View style={[styles.swatch, { backgroundColor: swatch }]} />
      ) : null}
      {icon ? <Icon name={icon} size={10} color={colors.text} /> : null}
      <Text allowFontScaling numberOfLines={1} style={typography.chip}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: spacing.pill,
    flexDirection: 'row',
    gap: 7,
    minHeight: 30,
    paddingHorizontal: 12,
  },
  swatch: { borderRadius: spacing.pill, height: 9, width: 9 },
});
