import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ActionMessage } from '../src/components/ActionMessage';
import { AppIconButton } from '../src/components/AppIconButton';
import { SettingRow } from '../src/components/SettingRow';
import { useAppStore } from '../src/store/useAppStore';
import { getPresetById } from '../src/features/wallpaper/presetRepository';
import { useTranslate } from '../src/features/i18n/useTranslate';
import type { StringKey } from '../src/features/i18n/t';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';

export default function SettingsScreen() {
  const state = useAppStore();
  const translate = useTranslate();
  const [pending, setPending] = useState<'randomize' | 'favorites'>();
  const [feedback, setFeedback] = useState<
    | {
        message: string;
        retry?: { kind: 'randomize' | 'favorites'; value: boolean };
      }
    | undefined
  >();
  const updatePreference = async (
    kind: 'randomize' | 'favorites',
    value: boolean,
  ) => {
    if (pending !== undefined) return;
    setPending(kind);
    setFeedback(undefined);
    const saved =
      kind === 'randomize'
        ? await state.setRandomizePreset(value)
        : await state.setFavoriteQuotesOnly(value);
    setPending(undefined);
    setFeedback(
      saved
        ? {
            message:
              kind === 'randomize'
                ? translate('settings.randomize.updated')
                : translate('settings.favoritesOnly.updated'),
          }
        : {
            message: translate('settings.error'),
            retry: { kind, value },
          },
    );
  };
  const preset = getPresetById(state.selectedPresetId);
  const presetName = preset
    ? translate(`preset.${preset.id}.name` as StringKey)
    : undefined;
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text allowFontScaling style={typography.eyebrow}>
              {translate('settings.eyebrow')}
            </Text>
            <Text allowFontScaling style={typography.screenTitle}>
              {translate('settings.title')}
            </Text>
          </View>
          <AppIconButton
            label={translate('common.back.label')}
            hint={translate('common.back.hint')}
            onPress={() => router.back()}
            symbol="‹"
          />
        </View>
        <ActionMessage
          title={translate('settings.preset.title')}
          message={presetName ?? translate('home.customize.hint')}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate('settings.preset.action')}
          accessibilityHint={translate('settings.preset.hint')}
          onPress={() => router.push('/customize')}
          style={styles.customize}
        >
          <Text allowFontScaling style={typography.button}>
            {translate('settings.preset.action')}
          </Text>
        </Pressable>
        <SettingRow
          label={translate('settings.randomize.label')}
          description={translate('settings.randomize.description')}
          value={state.randomizePreset}
          disabled={pending !== undefined}
          onValueChange={(value) => void updatePreference('randomize', value)}
        />
        <SettingRow
          label={translate('settings.favoritesOnly.label')}
          description={translate('settings.favoritesOnly.description')}
          value={state.favoriteQuotesOnly}
          disabled={
            pending !== undefined || state.favoriteQuoteIds.length === 0
          }
          onValueChange={(value) => void updatePreference('favorites', value)}
        />
        {feedback ? (
          <ActionMessage
            message={feedback.message}
            tone={feedback.retry ? 'error' : 'default'}
          />
        ) : null}
        {feedback?.retry ? (
          <AppIconButton
            label={translate('settings.retry.label')}
            hint={translate('settings.retry.hint')}
            onPress={() =>
              void updatePreference(feedback.retry!.kind, feedback.retry!.value)
            }
            symbol="↻"
          />
        ) : null}
        <ActionMessage
          title={translate('settings.about.title')}
          message={translate('settings.about.message')}
        />
        <Text allowFontScaling style={styles.version}>
          Motivana 1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.x2,
    paddingHorizontal: spacing.x2,
    paddingBottom: spacing.x4,
  },
  customize: {
    alignItems: 'center',
    borderColor: colors.accent,
    borderRadius: spacing.radius,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: spacing.control,
    paddingHorizontal: spacing.x2,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  version: { color: colors.mutedText, fontSize: 14, textAlign: 'center' },
});
