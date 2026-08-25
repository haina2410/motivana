import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMessage } from '../src/components/ActionMessage';
import { AppIconButton } from '../src/components/AppIconButton';
import { Meter } from '../src/components/Meter';
import { SafeAreaGuides } from '../src/components/SafeAreaGuides';
import { Segmented } from '../src/components/Segmented';
import { getQuoteById } from '../src/features/quotes/quoteRepository';
import { createComposition } from '../src/features/wallpaper/composition';
import {
  getAllPresets,
  getPresetById,
} from '../src/features/wallpaper/presetRepository';
import type { FontFamily, TextAlign } from '../src/features/wallpaper/types';
import { WallpaperCanvas } from '../src/features/wallpaper/WallpaperCanvas';
import { useTranslate } from '../src/features/i18n/useTranslate';
import type { StringKey } from '../src/features/i18n/t';
import { useAppStore } from '../src/store/useAppStore';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';

/** One specimen glyph per bundled family, with the tone mark that matters. */
const specimens: readonly {
  family: FontFamily;
  fontFamily: string;
  fontSize: number;
}[] = [
  {
    family: 'CormorantGaramond',
    fontFamily: 'CormorantGaramond-Light',
    fontSize: 21,
  },
  { family: 'Lora', fontFamily: 'Lora-Regular', fontSize: 19 },
  {
    family: 'BeVietnamPro',
    fontFamily: 'BeVietnamPro-Light',
    fontSize: 19,
  },
  {
    family: 'DancingScript',
    fontFamily: 'DancingScript-Medium',
    fontSize: 21,
  },
];

const alignments: readonly TextAlign[] = ['left', 'center', 'right'];

/**
 * Screen 1e of the board. Every control here is preset-backed on purpose: the
 * Kotlin rotation worker renders from the same preset, so a value the reader
 * could change here but the worker could not read would make the scheduled
 * wallpaper disagree with this preview. Typeface picks a preset; size, line
 * height and alignment report what that preset carries.
 */
export default function StyleScreen() {
  const state = useAppStore();
  const translate = useTranslate();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const presets = getAllPresets();
  const preset = getPresetById(state.selectedPresetId);
  const quote = getQuoteById(state.currentQuoteId);
  const composition = useMemo(
    () =>
      preset && quote
        ? createComposition({
            preset,
            quote,
            width: 420,
            height: 744,
            locale: state.contentLocale,
          })
        : undefined,
    [preset, quote, state.contentLocale],
  );
  const selectFamily = async (family: FontFamily) => {
    if (busy) return;
    const match =
      presets.find(
        (candidate) =>
          candidate.fontFamily === family &&
          candidate.textAlign === preset?.textAlign,
      ) ?? presets.find((candidate) => candidate.fontFamily === family);
    if (!match || match.id === state.selectedPresetId) return;
    setBusy(true);
    setFailed(false);
    const selected = await state.selectPreset(match.id);
    setBusy(false);
    setFailed(!selected);
  };
  if (!preset || !composition) return null;

  const sizeRange = extent(presets.map((p) => p.preferredFontSizeRatio));
  const lineHeightRange = extent(presets.map((p) => p.lineHeight));

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.bar}>
        <AppIconButton
          icon="xmark"
          label={translate('style.close.label')}
          hint={translate('style.close.hint')}
          onPress={() => router.back()}
          variant="plain"
        />
        <Text allowFontScaling style={styles.barTitle}>
          {translate('style.title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate('style.done')}
          accessibilityHint={translate('style.done.hint')}
          onPress={() => router.back()}
        >
          <Text allowFontScaling style={styles.done}>
            {translate('style.done')}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.preview}>
          <WallpaperCanvas
            composition={composition}
            style={StyleSheet.absoluteFill}
          />
          {state.showSafeGuides ? <SafeAreaGuides /> : null}
        </View>
        {failed ? (
          <ActionMessage tone="error" message={translate('style.error')} />
        ) : null}

        <Text allowFontScaling style={typography.sectionLabel}>
          {translate('style.typeface.label')}
        </Text>
        <View style={styles.specimens}>
          {specimens.map((specimen) => {
            const active = preset.fontFamily === specimen.family;
            const name = translate(
              `preset.face.${specimen.family}` as StringKey,
            );
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={translate('style.typeface.option', {
                  name,
                })}
                accessibilityState={{ selected: active, disabled: busy }}
                disabled={busy}
                key={specimen.family}
                onPress={() => void selectFamily(specimen.family)}
                style={[styles.specimen, active && styles.specimenActive]}
              >
                <Text
                  allowFontScaling={false}
                  style={{
                    color: active ? colors.text : colors.mutedText,
                    fontFamily: specimen.fontFamily,
                    fontSize: specimen.fontSize,
                  }}
                >
                  Ắa
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text allowFontScaling style={typography.sectionLabel}>
          {translate('style.size.label')}
        </Text>
        <Meter
          fraction={fraction(preset.preferredFontSizeRatio, sizeRange)}
          label={translate('style.size.value', {
            percent: (preset.preferredFontSizeRatio * 100).toFixed(1),
          })}
        />

        <Text allowFontScaling style={typography.sectionLabel}>
          {translate('style.lineHeight.label')}
        </Text>
        <Meter
          fraction={fraction(preset.lineHeight, lineHeightRange)}
          label={translate('style.lineHeight.note', {
            value: preset.lineHeight.toFixed(2),
          })}
        />

        <Text allowFontScaling style={typography.sectionLabel}>
          {translate('style.alignment.label')}
        </Text>
        <Segmented
          options={alignments.map((alignment) => ({
            value: alignment,
            label: alignment,
            icon: `align-${alignment}` as const,
            accessibilityLabel: translate(
              `style.alignment.${alignment}` as StringKey,
            ),
          }))}
          readOnly
          selected={preset.textAlign}
        />
        <Text allowFontScaling style={styles.footnote}>
          {translate('style.readOnly')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function extent(values: readonly number[]): { min: number; max: number } {
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** Keeps a single-valued catalog from dividing by zero. */
function fraction(value: number, range: { min: number; max: number }): number {
  const span = range.max - range.min;
  return span === 0 ? 1 : (value - range.min) / span;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  bar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.x2 + 2,
    paddingVertical: 6,
  },
  barTitle: { ...typography.rowLabel, fontSize: 14 },
  done: { ...typography.button, color: colors.accent },
  content: {
    gap: 10,
    paddingBottom: spacing.x4,
    paddingHorizontal: spacing.x2 + 2,
    paddingTop: spacing.x1,
  },
  preview: {
    alignSelf: 'center',
    aspectRatio: 420 / 744,
    borderRadius: spacing.radius + 4,
    marginBottom: spacing.x1,
    overflow: 'hidden',
    width: '46%',
  },
  specimens: { flexDirection: 'row', gap: spacing.x1 },
  specimen: {
    alignItems: 'center',
    borderColor: colors.borderSubtle,
    borderRadius: spacing.x1,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  specimenActive: { borderColor: colors.accent },
  footnote: { ...typography.caption, fontSize: 11, marginTop: 6 },
});
