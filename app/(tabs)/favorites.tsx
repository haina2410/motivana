import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMessage } from '../../src/components/ActionMessage';
import { AppButton } from '../../src/components/AppButton';
import { AppIconButton } from '../../src/components/AppIconButton';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import {
  favoriteQuoteText,
  getQuoteById,
} from '../../src/features/quotes/quoteRepository';
import type { Quote } from '../../src/features/quotes/types';
import type { ContentLocale } from '../../src/features/i18n/locale';
import { useTranslate } from '../../src/features/i18n/useTranslate';
import { useAppStore } from '../../src/store/useAppStore';
import { showToast } from '../../src/store/useToastStore';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

/**
 * Screen 1g of the board. Saved quotes are shown as text the reader can read at
 * a glance. A wallpaper thumbnail small enough for a grid makes its own quote
 * too small to read, so the words carry the row and the style stays on the deck.
 */
export default function FavoritesScreen() {
  const state = useAppStore();
  const translate = useTranslate();
  const favorites = state.favoriteQuoteIds.flatMap((id) => {
    const quote = getQuoteById(id);
    return quote ? [quote] : [];
  });
  // Rotation can be set to draw from saved quotes only, and the store then
  // refuses to drop the last one. The reader is told why instead of seeing
  // nothing happen.
  const removeFavorite = async (quoteId: string) => {
    const removed = await state.toggleFavorite(quoteId);
    showToast(
      translate(removed ? 'favorites.removed' : 'favorites.remove.error'),
      removed ? 'default' : 'error',
    );
  };
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
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {favorites.map((quote) => (
              <SavedRow
                key={quote.id}
                locale={state.contentLocale}
                onPress={() => {
                  state.selectQuote(quote.id);
                  router.navigate('/');
                }}
                onRemove={() => void removeFavorite(quote.id)}
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
    </SafeAreaView>
  );
}

/** One saved quote, read as words rather than as a wallpaper. */
function SavedRow({
  quote,
  locale,
  onPress,
  onRemove,
}: {
  quote: Quote;
  locale: ContentLocale;
  onPress: () => void;
  onRemove: () => void;
}) {
  const translate = useTranslate();
  const text = favoriteQuoteText(quote, locale);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={translate('favorites.item.label', { text })}
      accessibilityHint={translate('favorites.item.hint')}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {/* The amber rule stands in for the wallpaper the row used to show. */}
      <View style={styles.rule} />
      <View style={styles.rowCopy}>
        <Text allowFontScaling style={styles.quote}>
          {text}
        </Text>
        {quote.author ? (
          <Text allowFontScaling style={styles.author}>
            {`— ${quote.author}`}
          </Text>
        ) : null}
      </View>
      <AppIconButton
        hint={translate('favorites.remove.hint')}
        icon="xmark"
        label={translate('favorites.remove.label', { text })}
        onPress={onRemove}
        variant="plain"
      />
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
  list: { gap: 10, paddingBottom: spacing.x2 },
  row: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: spacing.radius,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.x2,
    overflow: 'hidden',
    padding: spacing.x2,
  },
  rule: {
    // The row centres its controls, so the rule asks for the full height back.
    alignSelf: 'stretch',
    backgroundColor: colors.accent,
    borderRadius: spacing.pill,
    width: 3,
  },
  rowCopy: { flex: 1, gap: 6 },
  quote: { ...typography.rowLabel, lineHeight: 23 },
  author: { ...typography.caption, color: colors.faintText },
  pressed: { opacity: 0.72 },
  empty: { flex: 1, justifyContent: 'center' },
});
