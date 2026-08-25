import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMessage } from '../src/components/ActionMessage';
import { AppButton } from '../src/components/AppButton';
import { DeckTabBar } from '../src/components/DeckTabBar';
import { PresetThumbnail } from '../src/components/PresetThumbnail';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { getQuoteById } from '../src/features/quotes/quoteRepository';
import { getAllPresets } from '../src/features/wallpaper/presetRepository';
import { useTranslate } from '../src/features/i18n/useTranslate';
import { useAppStore } from '../src/store/useAppStore';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';

/** Screen 1f of the board: eight curated presets, two to a row. */
export default function CustomizeScreen() {
  const state = useAppStore();
  const translate = useTranslate();
  const [pendingPresetId, setPendingPresetId] = useState<string>();
  const [failedPresetId, setFailedPresetId] = useState<string>();
  const selectPreset = async (presetId: string) => {
    if (pendingPresetId !== undefined) return;
    setPendingPresetId(presetId);
    setFailedPresetId(undefined);
    const selected = await state.selectPreset(presetId);
    setPendingPresetId(undefined);
    if (selected) {
      router.navigate('/');
      return;
    }
    setFailedPresetId(presetId);
  };
  const quote = getQuoteById(state.currentQuoteId);
  const presets = getAllPresets();
  if (!quote) return null;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <View style={styles.body}>
        <ScreenHeader
          title={translate('customize.title')}
          subtitle={translate('presets.subtitle')}
        />
        {failedPresetId ? (
          <View style={styles.feedback}>
            <ActionMessage
              tone="error"
              message={translate('customize.error')}
            />
            <AppButton
              hint={translate('customize.retry.hint')}
              icon="rotate-right"
              label={translate('customize.retry.label')}
              onPress={() => void selectPreset(failedPresetId)}
              variant="outline"
            />
          </View>
        ) : null}
        <ScrollView
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        >
          {presets.map((preset) => (
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
        </ScrollView>
      </View>
      <DeckTabBar active="presets" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  body: {
    flex: 1,
    gap: spacing.x2,
    paddingHorizontal: spacing.x2 + 2,
    paddingTop: spacing.x1,
  },
  feedback: { gap: spacing.x1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: spacing.x3,
  },
  slot: { flexBasis: '47%', flexGrow: 1 },
});
