import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

/**
 * The launcher furniture the wallpaper has to live under: the clock band at the
 * top and the icon margin around the edge. Drawn over the preview only, never
 * into the exported image.
 */
export function SafeAreaGuides() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    >
      <View style={styles.margin} />
      <Text allowFontScaling={false} style={styles.clock}>
        9:41
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  margin: {
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    bottom: '10%',
    left: '8%',
    position: 'absolute',
    right: '8%',
    top: '10%',
  },
  clock: {
    color: colors.faintText,
    fontFamily: fonts.light,
    fontSize: 34,
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    top: '6%',
  },
});
