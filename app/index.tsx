import { router } from 'expo-router';
import { Component, type ReactNode, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  PixelRatio,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMessage } from '../src/components/ActionMessage';
import { AppIconButton } from '../src/components/AppIconButton';
import { Toast } from '../src/components/Toast';
import { WallpaperActions } from '../src/components/WallpaperActions';
import { getQuoteById } from '../src/features/quotes/quoteRepository';
import { createComposition } from '../src/features/wallpaper/composition';
import type { WallpaperComposition } from '../src/features/wallpaper/composition';
import {
  fitPreviewBox,
  wallpaperPixelDimensions,
} from '../src/features/wallpaper/dimensions';
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
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteFeedback, setFavoriteFeedback] = useState<
    { message: string; retryQuoteId?: string } | undefined
  >();
  const updateFavorite = async (quoteId: string) => {
    if (favoriteBusy) return;
    const wasFavorite = state.favoriteQuoteIds.includes(quoteId);
    setFavoriteBusy(true);
    setFavoriteFeedback(undefined);
    const saved = await state.toggleFavorite(quoteId);
    setFavoriteBusy(false);
    setFavoriteFeedback(
      saved
        ? {
            message: wasFavorite
              ? 'Quote removed from favorites.'
              : 'Quote added to favorites.',
          }
        : {
            message: 'Could not update favorites for rotation. Try again.',
            retryQuoteId: quoteId,
          },
    );
  };
  const dimensions = wallpaperPixelDimensions(width, height, PixelRatio.get());
  // Keeps one composition object, so the preview renders and encodes only when
  // the quote, the preset or the screen size changes.
  const composition: WallpaperComposition | undefined = useMemo(() => {
    if (!fonts) return undefined;
    try {
      return createWallpaperComposition(
        state.currentQuoteId,
        state.selectedPresetId,
        dimensions.width,
        dimensions.height,
      );
    } catch {
      return undefined;
    }
  }, [
    dimensions.height,
    dimensions.width,
    fonts,
    state.currentQuoteId,
    state.selectedPresetId,
  ]);

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
      ) : (
        <PreviewErrorBoundary>
          <WallpaperPreview composition={composition} />
        </PreviewErrorBoundary>
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
            hint="Shows a random motivational quote."
            onPress={state.randomQuote}
            symbol="›"
          />
          <AppIconButton
            disabled={favoriteBusy}
            label={
              state.favoriteQuoteIds.includes(state.currentQuoteId)
                ? 'Unfavorite quote'
                : 'Favorite quote'
            }
            hint="Adds or removes the current quote from favorites."
            onPress={() => void updateFavorite(state.currentQuoteId)}
            symbol="♥"
          />
        </View>
        {favoriteFeedback ? (
          <Toast
            duration={favoriteFeedback.retryQuoteId ? 0 : 4000}
            message={favoriteFeedback.message}
            onDismiss={() => setFavoriteFeedback(undefined)}
            tone={favoriteFeedback.retryQuoteId ? 'error' : 'default'}
          />
        ) : null}
        {favoriteFeedback?.retryQuoteId ? (
          <AppIconButton
            label="Retry favorite update"
            hint="Retries updating the favorite used by wallpaper rotation."
            onPress={() => void updateFavorite(favoriteFeedback.retryQuoteId!)}
            symbol="↻"
          />
        ) : null}
        {fonts && composition ? (
          <WallpaperActions composition={composition} fontProvider={fonts} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function WallpaperPreview({
  composition,
}: {
  composition: WallpaperComposition | undefined;
}) {
  if (!composition) {
    throw new Error('The selected wallpaper data is unavailable.');
  }
  return <FittedPreview composition={composition} />;
}

function FittedPreview({
  composition,
}: {
  composition: WallpaperComposition;
}) {
  const [area, setArea] = useState<{ width: number; height: number }>();
  const onAreaLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setArea((current) =>
      current?.width === width && current?.height === height
        ? current
        : { width, height },
    );
  };
  const box = area
    ? fitPreviewBox(area, composition.width / composition.height)
    : undefined;
  return (
    <View onLayout={onAreaLayout} style={styles.previewArea}>
      <View style={[styles.preview, box]}>
        <WallpaperCanvas
          composition={composition}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

function createWallpaperComposition(
  quoteId: string,
  presetId: string,
  width: number,
  height: number,
): WallpaperComposition {
  const quote = getQuoteById(quoteId);
  const preset = getPresetById(presetId);
  if (!quote || !preset) {
    throw new Error('The selected wallpaper data is unavailable.');
  }
  return createComposition({
    quote,
    preset,
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  });
}

interface PreviewErrorBoundaryProps {
  children: ReactNode;
}

interface PreviewErrorBoundaryState {
  hasError: boolean;
}

class PreviewErrorBoundary extends Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  state: PreviewErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PreviewErrorBoundaryState {
    return { hasError: true };
  }

  private retry = () => this.setState({ hasError: false });

  render() {
    return this.state.hasError ? (
      <RenderError onRetry={this.retry} />
    ) : (
      this.props.children
    );
  }
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
  previewArea: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 280,
  },
  preview: {
    overflow: 'hidden',
    borderRadius: spacing.radiusLarge,
  },
  title: typography.title,
});
