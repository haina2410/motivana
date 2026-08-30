import { router } from 'expo-router';
import { Component, type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  PixelRatio,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionMessage } from '../../src/components/ActionMessage';
import { AppButton } from '../../src/components/AppButton';
import { AppIconButton } from '../../src/components/AppIconButton';
import { DeckPager } from '../../src/components/DeckPager';
import { Icon } from '../../src/components/Icon';
import { SafeAreaGuides } from '../../src/components/SafeAreaGuides';
import { SetWallpaperSheet } from '../../src/components/SetWallpaperSheet';
import { Toast } from '../../src/components/Toast';
import { getQuoteById } from '../../src/features/quotes/quoteRepository';
import { createComposition } from '../../src/features/wallpaper/composition';
import type { WallpaperComposition } from '../../src/features/wallpaper/composition';
import { wallpaperPixelDimensions } from '../../src/features/wallpaper/dimensions';
import { exportWallpaper } from '../../src/features/wallpaper/exportWallpaper';
import { getBackgroundImage } from '../../src/features/wallpaper/useBackgroundImage';
import {
  getPresetById,
  presetDisplayName,
} from '../../src/features/wallpaper/presetRepository';
import { fitWallpaper } from '../../src/features/wallpaper/fit';
import type { ContentLocale } from '../../src/features/i18n/locale';
import { useTranslate } from '../../src/features/i18n/useTranslate';
import { WallpaperCanvas } from '../../src/features/wallpaper/WallpaperCanvas';
import { useWallpaperFonts } from '../../src/features/wallpaper/useWallpaperFonts';
import { saveWallpaper } from '../../src/services/mediaLibrary';
import {
  currentDeckTrail,
  currentPendingPair,
  useAppStore,
} from '../../src/store/useAppStore';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {
    provider: fonts,
    failed: fontsFailed,
    retry: retryFonts,
  } = useWallpaperFonts();
  const state = useAppStore();
  const translate = useTranslate();
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [targetSheetOpen, setTargetSheetOpen] = useState(false);
  const [favoriteFeedback, setFavoriteFeedback] = useState<
    { message: string; retryQuoteId?: string } | undefined
  >();
  // The tab bar is an in-flow sibling below this screen (DeckTabBar in
  // app/(tabs)/_layout.tsx), not an overlay, so the screen's own box is
  // shorter than the window. WallpaperCanvas cover-fits the composition into
  // that same box (measured the same way, on a wrapping View, since Skia's
  // <Canvas> rejects onLayout on Android); the caption has to use the
  // identical box and fit or it drifts off the quote as the tab bar grows.
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  }>();
  const onContainerLayout = (event: LayoutChangeEvent) => {
    const { width: boxWidth, height: boxHeight } = event.nativeEvent.layout;
    setContainerSize((current) =>
      current?.width === boxWidth && current?.height === boxHeight
        ? current
        : { width: boxWidth, height: boxHeight },
    );
  };
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
  // Keeps one composition object, so the preview renders only when the quote,
  // the preset or the screen size changes.
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
  // The canvas draws from a recorded picture, which needs the typefaces, so the
  // deck waits for them. An unresolvable quote is not a wait: the deck raises
  // it, so the reader gets the render error and its retry rather than a spinner
  // that never ends.
  const previewReady = composition === undefined || !!fonts;
  const isFavorite = state.favoriteQuoteIds.includes(state.currentQuoteId);
  // The export is a full Skia render, so a second tap has to be turned away
  // rather than starting another one.
  const saveToLibrary = async () => {
    if (saveBusy || !fonts || !composition) return;
    setSaveBusy(true);
    setFavoriteFeedback(undefined);
    try {
      const rendered = await exportWallpaper(composition, fonts);
      await saveWallpaper(rendered.uri);
      setFavoriteFeedback({ message: translate('home.saved.confirmation') });
    } catch {
      setFavoriteFeedback({ message: translate('home.saved.error') });
    } finally {
      setSaveBusy(false);
    }
  };
  // A refused advance leaves the card animating back to centre with nothing
  // else to show for it, so it gets the same toast every other failure on
  // this screen gets. A refused rewind does not: the pager reports the gesture
  // at either end of the trail, and "there is nothing before this" is the
  // normal answer, not a failure.
  const advanceDeck = async () => {
    if (!(await state.advanceDeck())) {
      setFavoriteFeedback({ message: translate('home.deck.error') });
    }
  };
  // The neighbours come from the trail the store would actually replay. Reading
  // deckHistory raw would show a card that rewindDeck then refuses, because
  // selectPreset moves the on-screen pair without recording a step.
  const { history, cursor } = currentDeckTrail(state);
  const previousPair = history[cursor - 1];
  // At the head of the trail there is nothing recorded yet to swipe forward
  // into, so the pair advanceDeck would commit next -- rolled ahead of the
  // swipe -- stands in, and the incoming card tracks the finger instead of
  // rendering empty until release.
  const nextPair = history[cursor + 1] ?? currentPendingPair(state);
  // The decode cache holds several full backgrounds, so warming the next
  // photograph costs nothing a later swipe would not have paid anyway. Reads
  // nextPair, already dropped when the trail cannot be replayed, so this never
  // warms a card the deck could not actually swipe to.
  useEffect(() => {
    const background = nextPair
      ? getPresetById(nextPair.presetId)?.background
      : undefined;
    if (background?.kind === 'image') {
      void getBackgroundImage(background.asset, 'full');
    }
  }, [nextPair]);

  return (
    <View
      onLayout={onContainerLayout}
      style={styles.screen}
      testID="wallpaper-viewport"
    >
      {/* The boundary sits outside the pager: the pager's viewport is one
          `accessible` element, so anything inside it collapses into the deck
          label and the retry button would never reach a screen reader. */}
      <PreviewErrorBoundary>
        <DeckPager
          onNext={() => void advanceDeck()}
          onPrevious={() => void state.rewindDeck()}
          nextLabel={translate('home.deck.next.label')}
          nextHint={translate('home.deck.next.hint')}
          previousLabel={translate('home.deck.previous.label')}
          previousHint={translate('home.deck.previous.hint')}
          previous={
            <DeckFace
              pair={previousPair}
              size={dimensions}
              locale={state.contentLocale}
            />
          }
          next={
            <DeckFace
              pair={nextPair}
              size={dimensions}
              locale={state.contentLocale}
            />
          }
        >
          {previewReady ? (
            <>
              <LiveFace composition={composition} />
              {state.showSafeGuides ? <SafeAreaGuides /> : null}
            </>
          ) : null}
        </DeckPager>
      </PreviewErrorBoundary>
      {/* A missing typeface asset never resolves, so the wait has to become the
          same error and retry an unrenderable card gets. */}
      {fontsFailed ? (
        <View style={styles.overlay}>
          <RenderError onRetry={retryFonts} />
        </View>
      ) : !previewReady ? (
        <View accessibilityRole="progressbar" style={styles.overlay}>
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
            <Text allowFontScaling style={styles.loadingText}>
              {translate('home.loading')}
            </Text>
          </View>
        </View>
      ) : null}
      <View
        pointerEvents="box-none"
        style={[styles.chrome, { paddingTop: insets.top }]}
      >
        <View style={styles.header}>
          <Text allowFontScaling style={styles.wordmark}>
            MOTIVANA
          </Text>
          <AppIconButton
            icon="sliders"
            label={translate('home.settings.label')}
            hint={translate('home.settings.hint')}
            onPress={() => router.push('/settings')}
          />
        </View>
      </View>
      {/* Sits outside the padded chrome box, at the screen's own top-left, so
          quoteBounds -- measured in the same box WallpaperCanvas cover-fits
          into -- lands exactly where it says without insets.top shifting it a
          second time. The style changes on every swipe, so this is the only
          way to tell which preset is on screen. */}
      {composition && containerSize ? (
        <PresetCaption
          composition={composition}
          containerSize={containerSize}
          name={presetDisplayName(composition.preset, translate)}
        />
      ) : null}
      <View pointerEvents="box-none" style={styles.footer}>
        <View style={styles.rail}>
          <AppIconButton
            disabled={favoriteBusy}
            icon="heart"
            tone={isFavorite ? 'accent' : 'default'}
            label={
              isFavorite
                ? translate('home.favorite.remove.label')
                : translate('home.favorite.add.label')
            }
            hint={translate('home.favorite.hint')}
            onPress={() => void updateFavorite(state.currentQuoteId)}
            variant="glass"
          />
          <AppIconButton
            icon="palette"
            label={translate('home.restyle.label')}
            hint={translate('home.restyle.hint')}
            onPress={() => router.navigate('/customize')}
            variant="glass"
          />
          <AppIconButton
            icon="download"
            label={translate('home.saveToLibrary.label')}
            hint={translate('home.saveToLibrary.hint')}
            disabled={saveBusy}
            onPress={() => void saveToLibrary()}
            variant="glass"
          />
        </View>
        {/* The chevron only reports the gesture; the pager owns the action. */}
        <View pointerEvents="none" style={styles.hint}>
          <Icon name="chevron-up" size={12} color={colors.dimText} />
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
          <AppButton
            hint={translate('home.favorite.retry.hint')}
            label={translate('home.favorite.retry.label')}
            onPress={() => void updateFavorite(favoriteFeedback.retryQuoteId!)}
            variant="outline"
          />
        ) : null}
        <AppButton
          disabled={!fonts || !composition}
          hint={translate('home.set.hint')}
          icon="mobile-screen"
          label={translate('home.set.label')}
          onPress={() => setTargetSheetOpen(true)}
          shape="pill"
        />
      </View>
      {fonts && composition ? (
        <SetWallpaperSheet
          composition={composition}
          fontProvider={fonts}
          onClose={() => setTargetSheetOpen(false)}
          visible={targetSheetOpen}
        />
      ) : null}
    </View>
  );
}

/**
 * The wallpaper the reader is on. It raises an unresolvable pair inside the
 * boundary, so the render error and its retry replace the card.
 */
function LiveFace({
  composition,
}: {
  composition: WallpaperComposition | undefined;
}) {
  if (!composition) {
    throw new Error('The selected wallpaper data is unavailable.');
  }
  return (
    <WallpaperCanvas
      composition={composition}
      fit="cover"
      style={StyleSheet.absoluteFill}
    />
  );
}

/**
 * The preset's name, positioned from the composition's own measurements
 * rather than a guessed constant. `quoteBounds` is in wallpaper pixels, and
 * fitWallpaper is what turns those into screen pixels -- the same call, with
 * the same box and the same `cover`, that WallpaperCanvas places the picture
 * with. Reading the scale from anywhere else is how the label drifted off the
 * quote once already.
 *
 * The anchor is the lower of the quote block and the author line (zero
 * height when the quote is unattributed): an attributed quote's author sits
 * close enough under the quote that a caption placed from quoteBounds alone
 * lands inside the author's own line, not below it.
 */
function PresetCaption({
  composition,
  containerSize,
  name,
}: {
  composition: WallpaperComposition;
  containerSize: { width: number; height: number };
  name: string;
}) {
  const placement = fitWallpaper(composition, containerSize, 'cover');
  const contentBottom = Math.max(
    composition.quoteBounds.y + composition.quoteBounds.height,
    composition.authorY + composition.authorLineHeight,
  );
  const left = placement.x + composition.quoteBounds.x * placement.scale;
  const ruleTop = placement.y + contentBottom * placement.scale + spacing.x3;
  const nameTop = ruleTop + 1 + spacing.x2;
  return (
    <View pointerEvents="none">
      <View style={[styles.rule, { left, top: ruleTop }]} />
      <Text
        allowFontScaling
        style={[styles.presetName, { left, top: nameTop }]}
      >
        {name}
      </Text>
    </View>
  );
}

/** A neighbouring wallpaper in the pager. Undefined at either end of the trail. */
function DeckFace({
  pair,
  size,
  locale,
}: {
  pair: { quoteId: string; presetId: string } | undefined;
  size: { width: number; height: number };
  locale: ContentLocale;
}) {
  const composition = useMemo(() => {
    if (!pair) return undefined;
    try {
      return createWallpaperComposition(
        pair.quoteId,
        pair.presetId,
        size.width,
        size.height,
        locale,
      );
    } catch {
      return undefined;
    }
  }, [locale, pair, size.height, size.width]);
  if (!composition) return null;
  return (
    <WallpaperCanvas
      composition={composition}
      fit="cover"
      style={StyleSheet.absoluteFill}
    />
  );
}

function createWallpaperComposition(
  quoteId: string,
  presetId: string,
  width: number,
  height: number,
  locale: ContentLocale,
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
  // Covers the deck rather than sitting inside it, so the pager keeps its
  // swipe actions while the spinner or the retry is on screen.
  overlay: {
    backgroundColor: colors.background,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  // The chrome floats over the full-bleed wallpaper, so it carries the safe
  // area itself rather than insetting the card.
  chrome: { left: 0, position: 'absolute', right: 0, top: 0 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.x2 + 2,
    paddingTop: spacing.x1,
  },
  wordmark: { ...typography.tab, color: colors.dimText, letterSpacing: 2.4 },
  rule: {
    backgroundColor: colors.border,
    height: 1,
    position: 'absolute',
    width: 36,
  },
  presetName: {
    ...typography.tab,
    color: colors.dimText,
    letterSpacing: 1.6,
    position: 'absolute',
    textTransform: 'uppercase',
  },
  footer: {
    bottom: 0,
    gap: spacing.x2,
    left: 0,
    paddingBottom: spacing.x2,
    paddingHorizontal: spacing.x2 + 2,
    position: 'absolute',
    right: 0,
  },
  rail: { alignItems: 'flex-end', alignSelf: 'flex-end', gap: spacing.x1 + 2 },
  hint: { alignItems: 'flex-start' },
  loading: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.x2,
    justifyContent: 'center',
    paddingHorizontal: spacing.x3,
  },
  loadingText: { ...typography.rowLabel, fontSize: 16 },
});
