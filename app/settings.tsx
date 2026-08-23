import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ActionMessage } from '../src/components/ActionMessage';
import { AppIconButton } from '../src/components/AppIconButton';
import { SettingRow } from '../src/components/SettingRow';
import { useAppStore } from '../src/store/useAppStore';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';

export default function SettingsScreen() {
  const state = useAppStore();
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text allowFontScaling style={typography.eyebrow}>
            KEEP IT YOURS
          </Text>
          <Text allowFontScaling style={typography.screenTitle}>
            Settings
          </Text>
        </View>
        <AppIconButton
          label="Back to Home"
          hint="Returns to the wallpaper preview."
          onPress={() => router.back()}
          symbol="‹"
        />
      </View>
      <SettingRow
        label="Randomize preset"
        description="Use a different curated style when rotation becomes available."
        value={state.randomizePreset}
        onValueChange={state.setRandomizePreset}
      />
      <SettingRow
        label="Use favorite quotes only"
        description="Keep future rotation focused on saved quotes."
        value={state.favoriteQuotesOnly}
        disabled={state.favoriteQuoteIds.length === 0}
        onValueChange={state.setFavoriteQuotesOnly}
      />
      <ActionMessage
        title="About Motivana"
        message="Create a focused wallpaper from a thought worth returning to."
      />
      <Text allowFontScaling style={styles.version}>
        Motivana 1.0.0
      </Text>
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
  version: { color: colors.mutedText, fontSize: 14, textAlign: 'center' },
});
