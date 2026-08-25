import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface MeterProps {
  /** 0 to 1, where this value sits inside the catalogue's range. */
  fraction: number;
  label: string;
}

/**
 * Reports where a preset sits on a scale. It reads like the board's slider but
 * it is deliberately not a control: the value belongs to the preset, and the
 * text under it is what the reader acts on.
 */
export function Meter({ fraction, label }: MeterProps) {
  const percent: `${number}%` = `${Math.round(
    Math.min(Math.max(fraction, 0), 1) * 100,
  )}%`;
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={label}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: percent }]} />
        <View style={[styles.knob, { left: percent }]} />
      </View>
      <Text allowFontScaling style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 2,
    height: 3,
    justifyContent: 'center',
    marginTop: 10,
  },
  fill: {
    backgroundColor: colors.accent,
    borderRadius: 2,
    height: 3,
  },
  knob: {
    backgroundColor: colors.text,
    borderRadius: spacing.pill,
    height: 15,
    marginLeft: -7.5,
    position: 'absolute',
    width: 15,
  },
  label: { ...typography.caption, fontSize: 11, marginTop: spacing.x1 },
});
