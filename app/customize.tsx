import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIconButton } from '../src/components/AppIconButton';
import { PresetThumbnail } from '../src/components/PresetThumbnail';
import { getQuoteById } from '../src/features/quotes/quoteRepository';
import { getAllPresets } from '../src/features/wallpaper/presetRepository';
import { useAppStore } from '../src/store/useAppStore';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';

export default function CustomizeScreen() {
  const state = useAppStore();
  const quote = getQuoteById(state.currentQuoteId);
  if (!quote) return null;
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text allowFontScaling style={typography.eyebrow}>
            YOUR VISUAL RHYTHM
          </Text>
          <Text allowFontScaling style={typography.screenTitle}>
            Customize
          </Text>
        </View>
        <AppIconButton
          label="Back to Home"
          hint="Returns to the wallpaper preview."
          onPress={() => router.back()}
          symbol="‹"
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {getAllPresets().map((preset) => (
          <PresetThumbnail
            key={preset.id}
            preset={preset}
            quote={quote}
            selected={state.selectedPresetId === preset.id}
            onPress={() => {
              state.selectPreset(preset.id);
              router.back();
            }}
          />
        ))}
      </ScrollView>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.x2,
    paddingBottom: spacing.x4,
  },
});
