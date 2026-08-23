import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMessage } from '../src/components/ActionMessage';
import { AppIconButton } from '../src/components/AppIconButton';
import { WallpaperActions } from '../src/components/WallpaperActions';
import { getQuoteById } from '../src/features/quotes/quoteRepository';
import { createComposition } from '../src/features/wallpaper/composition';
import { getPresetById } from '../src/features/wallpaper/presetRepository';
import { WallpaperCanvas } from '../src/features/wallpaper/WallpaperCanvas';
import { useWallpaperFonts } from '../src/features/wallpaper/useWallpaperFonts';
import { useAppStore } from '../src/store/useAppStore';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const fonts = useWallpaperFonts();
  const state = useAppStore();
  const [, retryPreview] = useState(0);
  const quote = getQuoteById(state.currentQuoteId);
  const preset = getPresetById(state.selectedPresetId);
  const canRender = quote !== undefined && preset !== undefined;
  const composition = canRender
    ? createComposition({
        quote,
        preset,
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height)),
      })
    : undefined;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text allowFontScaling style={typography.eyebrow}>
            MAKE YOUR FOCUS VISIBLE
          </Text>
          <Text allowFontScaling style={styles.title}>
            Motivana
          </Text>
        </View>
        <View style={styles.nav}>
          <AppIconButton
            label="Customize wallpaper"
            hint="Choose a wallpaper preset."
            onPress={() => router.push('/customize')}
            symbol="✦"
          />
          <AppIconButton
            label="Open favorites"
            hint="Browse favorite quotes."
            onPress={() => router.push('/favorites')}
            symbol="♥"
          />
          <AppIconButton
            label="Open automation"
            hint="Review wallpaper rotation preferences."
            onPress={() => router.push('/automation')}
            symbol="◷"
          />
          <AppIconButton
            label="Open settings"
            hint="Change application preferences."
            onPress={() => router.push('/settings')}
            symbol="⚙"
          />
        </View>
      </View>
      {!fonts ? (
        <View accessibilityRole="progressbar" style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <Text allowFontScaling style={styles.loadingText}>
            Preparing your wallpaper
          </Text>
        </View>
      ) : !composition ? (
        <RenderError onRetry={() => retryPreview((attempt) => attempt + 1)} />
      ) : (
        <View style={styles.preview}>
          <WallpaperCanvas
            composition={composition}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}
      <View style={styles.footer}>
        <View style={styles.controls}>
          <AppIconButton
            label="Previous quote"
            hint="Shows the previous motivational quote."
            onPress={state.previousQuote}
            symbol="‹"
          />
          <AppIconButton
            label="Next quote"
            hint="Shows the next motivational quote."
            onPress={state.nextQuote}
            symbol="›"
          />
          <AppIconButton
            label={
              state.favoriteQuoteIds.includes(state.currentQuoteId)
                ? 'Unfavorite quote'
                : 'Favorite quote'
            }
            hint="Adds or removes the current quote from favorites."
            onPress={() => state.toggleFavorite(state.currentQuoteId)}
            symbol="♥"
          />
          <AppIconButton
            label="Random quote"
            hint="Chooses a different quote at random."
            onPress={state.randomQuote}
            symbol="↻"
          />
        </View>
        <WallpaperActions />
      </View>
    </SafeAreaView>
  );
}

function RenderError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.loading}>
      <ActionMessage
        tone="error"
        title="Wallpaper preview"
        message="Preview could not render."
      />
      <AppIconButton
        label="Retry preview"
        hint="Tries to render the current wallpaper again."
        onPress={onRetry}
        symbol="↻"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    gap: spacing.x2,
    paddingHorizontal: spacing.x2,
    paddingVertical: spacing.x1,
  },
  header: { gap: spacing.x1 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  footer: { gap: spacing.x1 },
  controls: {
    flexDirection: 'row',
    gap: spacing.x1,
    justifyContent: 'space-between',
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.x2,
    justifyContent: 'center',
  },
  loadingText: { color: colors.text, fontSize: 17, fontWeight: '700' },
  preview: {
    flex: 1,
    minHeight: 280,
    overflow: 'hidden',
    borderRadius: spacing.radiusLarge,
  },
  title: typography.title,
});
