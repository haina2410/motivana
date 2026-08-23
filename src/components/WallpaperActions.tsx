import { StyleSheet, Text, View } from 'react-native';

import { AppIconButton } from './AppIconButton';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export function WallpaperActions() {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <AppIconButton
          disabled
          hint="Saving is not available until Android wallpaper support is installed."
          label="Save wallpaper"
          onPress={() => undefined}
          symbol="↓"
        />
        <AppIconButton
          disabled
          hint="Setting wallpaper is not available until Android wallpaper support is installed."
          label="Set wallpaper"
          onPress={() => undefined}
          symbol="▣"
        />
      </View>
      <Text allowFontScaling style={styles.copy}>
        Saving and setting wallpapers arrives with Android support in Task 6.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.x1 },
  row: { flexDirection: 'row', gap: spacing.x1 },
  copy: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
});
