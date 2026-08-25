import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMessage } from '../src/components/ActionMessage';
import { AppButton } from '../src/components/AppButton';
import { DeckTabBar } from '../src/components/DeckTabBar';
import { ScreenHeader } from '../src/components/ScreenHeader';
import {
  favoriteQuoteText,
  getQuoteById,
} from '../src/features/quotes/quoteRepository';
import { createComposition } from '../src/features/wallpaper/composition';
import { getAllPresets } from '../src/features/wallpaper/presetRepository';
import { WallpaperCanvas } from '../src/features/wallpaper/WallpaperCanvas';
import type { Quote } from '../src/features/quotes/types';
import type { WallpaperPreset } from '../src/features/wallpaper/types';
import type { Locale } from '../src/features/i18n/locale';
import { useTranslate } from '../src/features/i18n/useTranslate';
import { useAppStore } from '../src/store/useAppStore';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';

/**
 * Screen 1g of the board. Saved quotes are shown as the wallpapers they make,
 * three to a row, so the reader recognises them the way they last saw them.
 */
export default function FavoritesScreen() {
  const state = useAppStore();
  const translate = useTranslate();
  const presets = getAllPresets();
  const favorites = state.favoriteQuoteIds.flatMap((id) => {
    const quote = getQuoteById(id);
    return quote ? [quote] : [];
  });
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.body}>
        <ScreenHeader
          title={translate('favorites.title')}
          actions={
            <Text allowFontScaling style={styles.count}>
              {translate('saved.count', { count: favorites.length })}
            </Text>
          }
        />
        {favorites.length === 0 ? (
          <View style={styles.empty}>
            <ActionMessage
              title={translate('favorites.empty.title')}
              message={translate('favorites.empty.message')}
            />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          >
            {favorites.map((quote, index) => (
              <SavedTile
                key={quote.id}
                locale={state.contentLocale}
                onPress={() => {
                  state.selectQuote(quote.id);
                  router.navigate('/');
                }}
                // Each saved quote keeps a stable style, so the grid reads as a
                // set of distinct wallpapers rather than one repeated colour.
                preset={presets[index % presets.length]!}
                quote={quote}
              />
            ))}
          </ScrollView>
        )}
        {favorites.length > 0 ? (
          <AppButton
            hint={translate('saved.rotate.hint')}
            icon="shuffle"
            label={translate('saved.rotate.label')}
            onPress={() => router.navigate('/automation')}
            shape="pill"
          />
        ) : null}
      </View>
      <DeckTabBar active="saved" />
    </SafeAreaView>
  );
}

function SavedTile({
  quote,
  preset,
  locale,
  onPress,
}: {
  quote: Quote;
  preset: WallpaperPreset;
  locale: Locale;
  onPress: () => void;
}) {
  const translate = useTranslate();
  const text = favoriteQuoteText(quote, locale);
  const composition = useMemo(
    () => createComposition({ preset, quote, width: 150, height: 220, locale }),
    [preset, quote, locale],
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={translate('favorites.item.label', { text })}
      accessibilityHint={translate('favorites.item.hint')}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <WallpaperCanvas
          composition={composition}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  body: {
    flex: 1,
    gap: spacing.x2,
    paddingBottom: spacing.x2,
    paddingHorizontal: spacing.x2 + 2,
    paddingTop: spacing.x1,
  },
  count: { ...typography.caption, marginTop: 6 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    paddingBottom: spacing.x2,
  },
  tile: {
    aspectRatio: 0.69,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: spacing.x1,
    borderWidth: 1,
    flexBasis: '31%',
    flexGrow: 1,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.72 },
  empty: { flex: 1, justifyContent: 'center' },
});
