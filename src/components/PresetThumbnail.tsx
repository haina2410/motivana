import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createComposition } from '../features/wallpaper/composition';
import { WallpaperCanvas } from '../features/wallpaper/WallpaperCanvas';
import type { WallpaperPreset } from '../features/wallpaper/types';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Quote } from '../features/quotes/types';

interface PresetThumbnailProps {
  preset: WallpaperPreset;
  quote: Quote;
  selected: boolean;
  onPress: () => void;
}

export function PresetThumbnail({
  preset,
  quote,
  selected,
  onPress,
}: PresetThumbnailProps) {
  const composition = createComposition({
    preset,
    quote,
    width: 180,
    height: 260,
  });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Use ${preset.name} preset`}
      accessibilityHint="Applies this wallpaper style and returns to Home."
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.card, selected && styles.selected]}
    >
      <View pointerEvents="none" style={styles.preview}>
        <WallpaperCanvas
          composition={composition}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Text allowFontScaling style={typography.button}>
        {preset.name}
      </Text>
      <Text allowFontScaling style={styles.caption}>
        {selected ? 'Selected' : 'Tap to use'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: spacing.radius,
    borderWidth: 1,
    flexBasis: '48%',
    gap: spacing.x1,
    overflow: 'hidden',
    padding: spacing.x1,
  },
  selected: { borderColor: colors.accent, borderWidth: 2 },
  preview: { aspectRatio: 0.69, borderRadius: 12, overflow: 'hidden' },
  caption: { color: colors.mutedText, fontSize: 13 },
});
