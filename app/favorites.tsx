import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMessage } from '../src/components/ActionMessage';
import { AppIconButton } from '../src/components/AppIconButton';
import { QuoteListItem } from '../src/components/QuoteListItem';
import { getQuoteById } from '../src/features/quotes/quoteRepository';
import { useAppStore } from '../src/store/useAppStore';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';

export default function FavoritesScreen() {
  const state = useAppStore();
  const favorites = state.favoriteQuoteIds.flatMap((id) => {
    const quote = getQuoteById(id);
    return quote ? [quote] : [];
  });
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text allowFontScaling style={typography.eyebrow}>
            KEEP WHAT LANDS
          </Text>
          <Text allowFontScaling style={typography.screenTitle}>
            Favorites
          </Text>
        </View>
        <AppIconButton
          label="Back to Home"
          hint="Returns to the wallpaper preview."
          onPress={() => router.back()}
          symbol="‹"
        />
      </View>
      {favorites.length === 0 ? (
        <View style={styles.empty}>
          <ActionMessage
            title="No favorites yet"
            message="Favorite a quote from Home to use it here."
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {favorites.map((quote) => (
            <QuoteListItem
              key={quote.id}
              quote={quote}
              onPress={() => {
                state.selectQuote(quote.id);
                router.back();
              }}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.x2,
    paddingHorizontal: spacing.x2,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  list: { gap: spacing.x2, paddingBottom: spacing.x4 },
  empty: { flex: 1, justifyContent: 'center' },
});
