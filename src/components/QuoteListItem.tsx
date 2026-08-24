import { Pressable, StyleSheet, Text } from 'react-native';

import { favoriteQuoteText } from '../features/quotes/quoteRepository';
import type { Quote } from '../features/quotes/types';
import { useTranslate } from '../features/i18n/useTranslate';
import { useAppStore } from '../store/useAppStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export function QuoteListItem({
  quote,
  onPress,
}: {
  quote: Quote;
  onPress: () => void;
}) {
  const translate = useTranslate();
  const contentLocale = useAppStore((state) => state.contentLocale);
  const text = favoriteQuoteText(quote, contentLocale);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={translate('favorites.item.label', { text })}
      accessibilityHint={translate('favorites.item.hint')}
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      <Text allowFontScaling style={styles.quote}>
        “{text}”
      </Text>
      {quote.author ? (
        <Text allowFontScaling style={styles.author}>
          — {quote.author}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: spacing.radius,
    borderWidth: 1,
    gap: spacing.x1,
    padding: spacing.x2,
  },
  pressed: { opacity: 0.72 },
  quote: { color: colors.text, fontSize: 17, lineHeight: 25 },
  author: { color: colors.mutedText, fontSize: 14 },
});
