import { Pressable, StyleSheet, Text } from 'react-native';

import type { Quote } from '../features/quotes/types';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export function QuoteListItem({
  quote,
  onPress,
}: {
  quote: Quote;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Use ${quote.text}`}
      accessibilityHint="Uses this favorite quote on the Home wallpaper."
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      <Text allowFontScaling style={styles.quote}>
        “{quote.text}”
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
