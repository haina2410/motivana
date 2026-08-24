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
  const presets = getAllPresets();
  const presetRows = presets.reduce<(typeof presets)[number][][]>(
    (rows, preset, index) => {
      if (index % 2 === 0) rows.push([preset]);
      else rows[rows.length - 1]!.push(preset);
      return rows;
    },
    [],
  );
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
        {presetRows.map((row) => (
          <View key={row[0]!.id} style={styles.row}>
            {row.map((preset) => (
              <View key={preset.id} style={styles.slot}>
                <PresetThumbnail
                  preset={preset}
                  quote={quote}
                  selected={state.selectedPresetId === preset.id}
                  onPress={() => {
                    void state.selectPreset(preset.id).then((selected) => {
                      if (selected) router.back();
                    });
                  }}
                />
              </View>
            ))}
          </View>
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
    gap: spacing.x2,
    paddingBottom: spacing.x4,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.x2,
    justifyContent: 'space-between',
  },
  slot: { flexBasis: '48%' },
});
