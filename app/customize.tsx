import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIconButton } from '../src/components/AppIconButton';
import { ActionMessage } from '../src/components/ActionMessage';
import { PresetThumbnail } from '../src/components/PresetThumbnail';
import { getQuoteById } from '../src/features/quotes/quoteRepository';
import { getAllPresets } from '../src/features/wallpaper/presetRepository';
import { useAppStore } from '../src/store/useAppStore';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';

export default function CustomizeScreen() {
  const state = useAppStore();
  const [pendingPresetId, setPendingPresetId] = useState<string>();
  const [failedPresetId, setFailedPresetId] = useState<string>();
  const selectPreset = async (presetId: string) => {
    if (pendingPresetId !== undefined) return;
    setPendingPresetId(presetId);
    setFailedPresetId(undefined);
    const selected = await state.selectPreset(presetId);
    setPendingPresetId(undefined);
    if (selected) {
      router.back();
      return;
    }
    setFailedPresetId(presetId);
  };
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
      {failedPresetId ? (
        <View style={styles.feedback}>
          <ActionMessage
            tone="error"
            message="Could not update the preset used for rotation. Try again."
          />
          <AppIconButton
            label="Retry preset update"
            hint="Retries updating the preset used by wallpaper rotation."
            onPress={() => void selectPreset(failedPresetId)}
            symbol="↻"
          />
        </View>
      ) : null}
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
                  locale={state.contentLocale}
                  selected={state.selectedPresetId === preset.id}
                  disabled={pendingPresetId !== undefined}
                  onPress={() => void selectPreset(preset.id)}
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
  feedback: { gap: spacing.x1 },
  row: {
    flexDirection: 'row',
    gap: spacing.x2,
    justifyContent: 'space-between',
  },
  slot: { flexBasis: '48%' },
});
