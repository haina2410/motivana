import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createComposition } from '../features/wallpaper/composition';
import { WallpaperCanvas } from '../features/wallpaper/WallpaperCanvas';
import type { WallpaperPreset } from '../features/wallpaper/types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import type { Quote } from '../features/quotes/types';
import type { ContentLocale } from '../features/i18n/locale';
import { useTranslate } from '../features/i18n/useTranslate';
import type { StringKey } from '../features/i18n/t';

interface PresetThumbnailProps {
  preset: WallpaperPreset;
  quote: Quote;
  locale: ContentLocale;
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
      style={[styles.card, disabled && styles.disabled]}
    >
      <View
        pointerEvents="none"
        style={[styles.preview, selected && styles.previewSelected]}
      >
        <WallpaperCanvas
          composition={composition}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Text allowFontScaling style={styles.name}>
        {name}
      </Text>
      <Text allowFontScaling style={styles.face}>
        {translate(`preset.face.${preset.fontFamily}` as StringKey)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 6, width: '100%' },
  disabled: { opacity: 0.48 },
  preview: {
    aspectRatio: 0.69,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  previewSelected: { borderColor: colors.accent, borderWidth: 2 },
  name: { ...typography.chip, marginTop: 2 },
  face: { ...typography.caption, color: colors.faintText, fontSize: 11 },
});
