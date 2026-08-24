import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createComposition } from '../features/wallpaper/composition';
import { WallpaperCanvas } from '../features/wallpaper/WallpaperCanvas';
import type { WallpaperPreset } from '../features/wallpaper/types';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Quote } from '../features/quotes/types';
import type { Locale } from '../features/i18n/locale';
import { useTranslate } from '../features/i18n/useTranslate';
import type { StringKey } from '../features/i18n/t';

interface PresetThumbnailProps {
  preset: WallpaperPreset;
  quote: Quote;
  locale: Locale;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export function PresetThumbnail({
  preset,
  quote,
  locale,
  selected,
  disabled = false,
  onPress,
}: PresetThumbnailProps) {
  const translate = useTranslate();
  // Keeps one composition object, so the preview renders and encodes one time.
  // The language belongs in the dependencies: it changes the rendered text.
  const composition = useMemo(
    () =>
      createComposition({
        preset,
        quote,
        width: 180,
        height: 260,
        locale,
      }),
    [preset, quote, locale],
  );
  const name = translate(`preset.${preset.id}.name` as StringKey);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={translate('preset.thumbnail.label', { name })}
      accessibilityHint={translate('preview.item.hint')}
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
        {name}
      </Text>
      <Text allowFontScaling style={styles.caption}>
        {selected
          ? translate('preset.thumbnail.selected')
          : translate('preset.thumbnail.tapToUse')}
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
