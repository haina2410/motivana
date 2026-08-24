import { useMemo } from 'react';
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
  disabled?: boolean;
  onPress: () => void;
}

export function PresetThumbnail({
  preset,
  quote,
  selected,
  disabled = false,
  onPress,
}: PresetThumbnailProps) {
  // Keeps one composition object, so the preview renders and encodes one time.
  const composition = useMemo(
    () =>
      createComposition({
        preset,
        quote,
        width: 180,
        height: 260,
      }),
    [preset, quote],
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Use ${preset.name} preset`}
      accessibilityHint="Applies this wallpaper style and returns to Home."
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.card,
        selected && styles.selected,
        disabled && styles.disabled,
      ]}
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
    gap: spacing.x1,
    overflow: 'hidden',
    padding: spacing.x1,
    width: '100%',
  },
  selected: { borderColor: colors.accent, borderWidth: 2 },
  disabled: { opacity: 0.48 },
  preview: { aspectRatio: 0.69, borderRadius: 12, overflow: 'hidden' },
  caption: { color: colors.mutedText, fontSize: 13 },
});
