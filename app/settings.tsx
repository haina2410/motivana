import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ActionMessage } from '../src/components/ActionMessage';
import { AppIconButton } from '../src/components/AppIconButton';
import { Choice } from '../src/components/Choice';
import { SettingRow } from '../src/components/SettingRow';
import { useAppStore } from '../src/store/useAppStore';
import { getPresetById } from '../src/features/wallpaper/presetRepository';
import { locales } from '../src/features/i18n/locale';
import { useTranslate } from '../src/features/i18n/useTranslate';
import type { StringKey } from '../src/features/i18n/t';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';

export default function SettingsScreen() {
  const state = useAppStore();
  const translate = useTranslate();
  const [pending, setPending] = useState<
    'randomize' | 'favorites' | 'app' | 'content'
  >();
  const [feedback, setFeedback] = useState<
    | {
        message: string;
        retry?: { kind: 'randomize' | 'favorites'; value: boolean };
      }
    | undefined
  >();
  const [languageMessage, setLanguageMessage] = useState<{
    text: string;
    tone: 'default' | 'error';
  }>();
  const updatePreference = async (
    kind: 'randomize' | 'favorites',
    value: boolean,
  ) => {
    if (pending !== undefined) return;
    setPending(kind);
    setFeedback(undefined);
    setLanguageMessage(undefined);
    // finally, so a rejected write cannot leave every control disabled.
    let saved: boolean;
    try {
      saved =
        kind === 'randomize'
          ? await state.setRandomizePreset(value)
          : await state.setFavoriteQuotesOnly(value);
    } finally {
      setPending(undefined);
    }
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
  const updateLanguage = async (
    kind: 'app' | 'content',
    locale: (typeof locales)[number],
  ) => {
    if (pending !== undefined) return;
    setPending(kind);
    setFeedback(undefined);
    setLanguageMessage(undefined);
    // finally, so a rejected write cannot leave every control disabled.
    let saved: boolean;
    try {
      saved =
        kind === 'app'
          ? await state.setAppLocale(locale)
          : await state.setContentLocale(locale);
    } finally {
      setPending(undefined);
    }
    setLanguageMessage(
      saved
        ? { text: translate('settings.language.updated'), tone: 'default' }
        : { text: translate('settings.language.error'), tone: 'error' },
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
        <View style={styles.section}>
          <Text allowFontScaling style={styles.label}>
            {translate('settings.appLanguage.label')}
          </Text>
          <Text allowFontScaling style={styles.description}>
            {translate('settings.appLanguage.description')}
          </Text>
          <View style={styles.choices}>
            {locales.map((locale) => (
              <Choice
                key={locale}
                label={translate(`language.${locale}` as StringKey)}
                accessibilityLabel={translate('settings.appLanguage.option', {
                  name: translate(`language.${locale}` as StringKey),
                })}
                selected={state.appLocale === locale}
                disabled={pending !== undefined}
                onPress={() => void updateLanguage('app', locale)}
              />
            ))}
          </View>
        </View>
        <View style={styles.section}>
          <Text allowFontScaling style={styles.label}>
            {translate('settings.contentLanguage.label')}
          </Text>
          <Text allowFontScaling style={styles.description}>
            {translate('settings.contentLanguage.description')}
          </Text>
          <View style={styles.choices}>
            {locales.map((locale) => (
              <Choice
                key={locale}
                label={translate(`language.${locale}` as StringKey)}
                accessibilityLabel={translate(
                  'settings.contentLanguage.option',
                  { name: translate(`language.${locale}` as StringKey) },
                )}
                selected={state.contentLocale === locale}
                disabled={pending !== undefined}
                onPress={() => void updateLanguage('content', locale)}
              />
            ))}
          </View>
        </View>
        {languageMessage ? (
          <ActionMessage
            message={languageMessage.text}
            tone={languageMessage.tone}
          />
        ) : null}
        <ActionMessage
          title={translate('settings.about.title')}
          message={translate('settings.about.message')}
        />
        <Text allowFontScaling style={styles.version}>
          Motivana 0.1.0
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
  section: { gap: spacing.x1 },
  label: { color: colors.text, fontSize: 16, fontWeight: '700' },
  description: { color: colors.mutedText, fontSize: 13 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x1 },
  version: { color: colors.mutedText, fontSize: 14, textAlign: 'center' },
});
