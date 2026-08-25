import { router } from 'expo-router';
import { Component, type ReactNode, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMessage } from '../src/components/ActionMessage';
import { AppButton } from '../src/components/AppButton';
import { AppIconButton } from '../src/components/AppIconButton';
import { Chip } from '../src/components/Chip';
import { DeckTabBar } from '../src/components/DeckTabBar';
import { SafeAreaGuides } from '../src/components/SafeAreaGuides';
import { SetWallpaperSheet } from '../src/components/SetWallpaperSheet';
import { Toast } from '../src/components/Toast';
import { getQuoteById } from '../src/features/quotes/quoteRepository';
import { createComposition } from '../src/features/wallpaper/composition';
import type { WallpaperComposition } from '../src/features/wallpaper/composition';
import {
  deckLayers,
  deckLayerReach,
} from '../src/features/wallpaper/deckLayers';
import { wallpaperPixelDimensions } from '../src/features/wallpaper/dimensions';
import { exportedWallpaperUri } from '../src/features/wallpaper/exportCache';
import { getPresetById } from '../src/features/wallpaper/presetRepository';
import type { WallpaperPreset } from '../src/features/wallpaper/types';
import type { Locale } from '../src/features/i18n/locale';
import { useTranslate } from '../src/features/i18n/useTranslate';
import type { StringKey } from '../src/features/i18n/t';
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
  const translate = useTranslate();
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [targetSheetOpen, setTargetSheetOpen] = useState(false);
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
              ? translate('home.favorite.removed')
              : translate('home.favorite.added'),
          }
        : {
            message: translate('home.favorite.error'),
            retryQuoteId: quoteId,
          },
    );
  };
  const dimensions = wallpaperPixelDimensions(width, height, PixelRatio.get());
  // Keeps one composition object, so the preview renders and encodes only when
  // the quote, the preset or the screen size changes.
  // Built without the typefaces: the deterministic measurer is enough for the
  // cache key, so an already exported wallpaper can be found in the first frame.
  const composition: WallpaperComposition | undefined = useMemo(() => {
    try {
      return createWallpaperComposition(
        state.currentQuoteId,
        state.selectedPresetId,
        dimensions.width,
        dimensions.height,
        state.contentLocale,
      );
    } catch {
      return undefined;
    }
  }, [
    dimensions.height,
    dimensions.width,
    state.contentLocale,
    state.currentQuoteId,
    state.selectedPresetId,
  ]);
  // The card can be drawn from the exported file alone, so the deck waits for
  // the typefaces only when this wallpaper was never exported.
  const exported = useMemo(
    () =>
      composition === undefined
        ? undefined
        : exportedWallpaperUri(composition.cacheKey),
    [composition],
  );
  // An unresolvable quote is not a wait: the deck raises it, so the reader gets
  // the render error and its retry rather than a spinner that never ends.
  const previewReady = composition === undefined || !!fonts || !!exported;
  const preset = getPresetById(state.selectedPresetId);
  const isFavorite = state.favoriteQuoteIds.includes(state.currentQuoteId);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text allowFontScaling style={styles.date}>
            {formatToday(state.appLocale)}
          </Text>
          <Text allowFontScaling style={styles.title}>
            {translate('home.today')}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {/* No heart here: the Saved tab already carries that direction. */}
          <AppIconButton
            icon="gear"
            label={translate('home.settings.label')}
            hint={translate('home.settings.hint')}
            onPress={() => router.push('/settings')}
          />
        </View>
      </View>
      {!previewReady ? (
        <View accessibilityRole="progressbar" style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <Text allowFontScaling style={styles.loadingText}>
            {translate('home.loading')}
          </Text>
        </View>
      ) : (
        <PreviewErrorBoundary>
          <PeekDeck
            composition={composition}
            onNext={state.randomQuote}
            preset={preset}
            showGuides={state.showSafeGuides}
          />
        </PreviewErrorBoundary>
      )}
      <View style={styles.footer}>
        <View style={styles.chips}>
          {preset ? (
            <>
              <Chip
                label={translate(`preset.${preset.id}.name` as StringKey)}
                swatch={presetSwatch(preset.id)}
              />
              <Chip
                icon="font"
                label={translate(
                  `preset.face.${preset.fontFamily}` as StringKey,
                )}
              />
            </>
          ) : null}
        </View>
        <View style={styles.actionRow}>
          <AppButton
            disabled={favoriteBusy}
            icon="heart"
            iconColor={isFavorite ? colors.accent : colors.text}
            label={
              isFavorite
                ? translate('home.favorite.remove.label')
                : translate('home.favorite.add.label')
            }
            hint={translate('home.favorite.hint')}
            onPress={() => void updateFavorite(state.currentQuoteId)}
            style={styles.actionButton}
            variant="outline"
          />
          <AppButton
            icon="wand-magic-sparkles"
            label={translate('home.restyle.label')}
            hint={translate('home.restyle.hint')}
            onPress={() => router.push('/style')}
            style={styles.actionButton}
            variant="outline"
          />
        </View>
        <AppButton
          disabled={!fonts || !composition}
          hint={translate('home.set.hint')}
          label={translate('home.set.label')}
          onPress={() => setTargetSheetOpen(true)}
        />
        {favoriteFeedback ? (
          <Toast
            duration={favoriteFeedback.retryQuoteId ? 0 : 4000}
            message={favoriteFeedback.message}
            onDismiss={() => setFavoriteFeedback(undefined)}
            tone={favoriteFeedback.retryQuoteId ? 'error' : 'default'}
          />
        ) : null}
        {favoriteFeedback?.retryQuoteId ? (
          <AppButton
            hint={translate('home.favorite.retry.hint')}
            label={translate('home.favorite.retry.label')}
            onPress={() => void updateFavorite(favoriteFeedback.retryQuoteId!)}
            variant="outline"
          />
        ) : null}
      </View>
      <DeckTabBar active="deck" />
      {fonts && composition ? (
        <SetWallpaperSheet
          composition={composition}
          fontProvider={fonts}
          onClose={() => setTargetSheetOpen(false)}
          visible={targetSheetOpen}
        />
      ) : null}
    </SafeAreaView>
  );
}

/**
 * The board's home direction: two wallpapers peek out behind the live card, so
 * the deck reads as a finite stack the reader handles rather than a feed. The
 * cards behind are drawn from the preset's own colour, not rendered.
 */
function PeekDeck({
  composition,
  onNext,
  preset,
  showGuides,
}: {
  composition: WallpaperComposition | undefined;
  onNext: () => boolean;
  preset: WallpaperPreset | undefined;
  showGuides: boolean;
}) {
  const translate = useTranslate();
  const layers = useMemo(() => deckLayers(preset), [preset]);
  if (!composition) {
    throw new Error('The selected wallpaper data is unavailable.');
  }
  // The card carries the wallpaper's own shape, so the preview fills it edge to
  // edge and the rounded corners read as the card the reader hands on.
  // The layers only reach right and down, so the stack moves back by half of
  // that reach to sit centred on the screen.
  const shape = {
    aspectRatio: composition.width / composition.height,
    marginRight: deckLayerReach,
  };
  return (
    <View style={styles.deck}>
      <View style={[styles.stack, shape]}>
        {/* Drawn far to near, so the nearest layer sits closest to the card. */}
        {[...layers].reverse().map((layer, index) => (
          <View
            key={index}
            pointerEvents="none"
            style={[
              styles.peek,
              {
                backgroundColor: layer.color,
                opacity: layer.opacity,
                transform: [
                  { translateX: layer.shift },
                  { translateY: layer.shift },
                ],
              },
            ]}
          />
        ))}
        <Pressable
          accessibilityHint={translate('home.next.hint')}
          accessibilityLabel={translate('home.next.label')}
          accessibilityRole="button"
          onPress={onNext}
          style={styles.card}
        >
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <WallpaperCanvas
              composition={composition}
              style={StyleSheet.absoluteFill}
            />
            {showGuides ? <SafeAreaGuides /> : null}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

/** The reader's own date, in their interface language. */
function formatToday(locale: Locale): string {
  const today = new Date();
  try {
    return today.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return today.toDateString();
  }
}

/** The dot on the preset chip, taken from the preset's own background. */
function presetSwatch(presetId: string): string {
  const preset = getPresetById(presetId);
  if (!preset) return colors.accent;
  return preset.background.kind === 'solid'
    ? preset.background.color
    : preset.background.startColor;
}

function createWallpaperComposition(
  quoteId: string,
  presetId: string,
  width: number,
  height: number,
  locale: Locale,
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
    locale,
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
  const translate = useTranslate();
  return (
    <View style={styles.loading}>
      <ActionMessage
        tone="error"
        title={translate('home.preview.title')}
        message={translate('home.preview.error')}
      />
      <AppButton
        hint={translate('home.preview.retry.hint')}
        icon="rotate-right"
        label={translate('home.preview.retry.label')}
        onPress={onRetry}
        variant="outline"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  header: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.x3,
    paddingTop: spacing.x1,
  },
  headerActions: { flexDirection: 'row', gap: spacing.x1 },
  date: { ...typography.caption, fontSize: 11, letterSpacing: 0.5 },
  title: { ...typography.title, fontSize: 21, marginTop: 6 },
  deck: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing.x4,
    paddingHorizontal: spacing.x3,
    paddingTop: spacing.x2,
  },
  // Sized by the card, so the layers behind it share the wallpaper's shape.
  stack: { flex: 1 },
  // The cards behind the live one share its frame, then move right and down.
  peek: {
    borderColor: colors.borderSubtle,
    borderRadius: spacing.radiusLarge,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  card: {
    borderRadius: spacing.radiusLarge,
    elevation: 12,
    flex: 1,
    overflow: 'hidden',
    shadowColor: colors.bezel,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
  },
  footer: { gap: 10, paddingHorizontal: spacing.x3, paddingBottom: spacing.x2 },
  chips: { alignItems: 'center', flexDirection: 'row', gap: spacing.x1 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionButton: { flex: 1 },
  loading: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.x2,
    justifyContent: 'center',
    paddingHorizontal: spacing.x3,
  },
  loadingText: { ...typography.rowLabel, fontSize: 16 },
});
