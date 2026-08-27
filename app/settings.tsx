import { useState } from 'react';
import {
  PixelRatio,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMessage } from '../src/components/ActionMessage';
import { Choice } from '../src/components/Choice';
import { Icon } from '../src/components/Icon';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Toggle } from '../src/components/Toggle';
import {
  readRunningUpdate,
  runningUpdateSummary,
} from '../src/services/updateStatus';
import { useAppStore } from '../src/store/useAppStore';
import { wallpaperPixelDimensions } from '../src/features/wallpaper/dimensions';
import { contentLocales, locales } from '../src/features/i18n/locale';
import { useTranslate } from '../src/features/i18n/useTranslate';
import type { StringKey } from '../src/features/i18n/t';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';

const version = '0.1.0';

// Fixed for the life of the process, so it is read once rather than per render.
const { update, runtime } = runningUpdateSummary(readRunningUpdate());

/** Screen 1j of the board. */
export default function SettingsScreen() {
  const state = useAppStore();
  const translate = useTranslate();
  const { width, height } = useWindowDimensions();
  const exportSize = wallpaperPixelDimensions(width, height, PixelRatio.get());
  const [pending, setPending] = useState<'app' | 'content'>();
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: 'default' | 'error';
  }>();
  const [languageMessage, setLanguageMessage] = useState<{
    text: string;
    tone: 'default' | 'error';
  }>();
  // Takes the write itself, because only the quote language accepts `all`.
  const updateLanguage = async (
    kind: 'app' | 'content',
    apply: () => Promise<boolean>,
  ) => {
    if (pending !== undefined) return;
    setPending(kind);
    setFeedback(undefined);
    setLanguageMessage(undefined);
    // finally, so a rejected write cannot leave every control disabled.
    let saved: boolean;
    try {
      saved = await apply();
    } finally {
      setPending(undefined);
    }
    setLanguageMessage(
      saved
        ? { text: translate('settings.language.updated'), tone: 'default' }
        : { text: translate('settings.language.error'), tone: 'error' },
    );
  };
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title={translate('settings.title')} />

        <View style={styles.offline}>
          <View style={styles.offlineHead}>
            <Icon name="shield-halved" size={13} color={colors.accent} />
            <Text allowFontScaling style={styles.offlineTitle}>
              {translate('settings.offline.title')}
            </Text>
          </View>
          <Text allowFontScaling style={styles.offlineBody}>
            {translate('settings.offline.message')}
          </Text>
        </View>

        <Text allowFontScaling style={typography.sectionLabel}>
          {translate('settings.export.label')}
        </Text>
        <View style={styles.list}>
          <InfoRow
            label={translate('settings.resolution.label')}
            value={`${exportSize.width} × ${exportSize.height}`}
          />
          <InfoRow
            label={translate('settings.language.label')}
            value={locales
              .map((locale) => translate(`language.${locale}` as StringKey))
              .join(' · ')}
          />
          <View style={styles.divider} />
          <Toggle
            label={translate('settings.saveToLibrary.label')}
            description={translate('settings.saveToLibrary.description')}
            value={state.saveToPhotoLibrary}
            onValueChange={(value) => {
              const saved = state.setSaveToPhotoLibrary(value);
              setFeedback({
                message: saved
                  ? translate('settings.saveToLibrary.updated')
                  : translate('settings.error'),
                tone: saved ? 'default' : 'error',
              });
            }}
          />
          <View style={styles.divider} />
          <Toggle
            label={translate('settings.safeGuides.label')}
            description={translate('settings.safeGuides.description')}
            value={state.showSafeGuides}
            onValueChange={(value) => {
              const saved = state.setShowSafeGuides(value);
              setFeedback({
                message: saved
                  ? translate('settings.safeGuides.updated')
                  : translate('settings.error'),
                tone: saved ? 'default' : 'error',
              });
            }}
          />
        </View>

        {feedback ? (
          <ActionMessage message={feedback.message} tone={feedback.tone} />
        ) : null}

        <Text allowFontScaling style={typography.sectionLabel}>
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
              onPress={() =>
                void updateLanguage('app', () => state.setAppLocale(locale))
              }
            />
          ))}
        </View>
        <Text allowFontScaling style={typography.sectionLabel}>
          {translate('settings.contentLanguage.label')}
        </Text>
        <Text allowFontScaling style={styles.description}>
          {translate('settings.contentLanguage.description')}
        </Text>
        <View style={styles.choices}>
          {contentLocales.map((locale) => (
            <Choice
              key={locale}
              label={translate(`language.${locale}` as StringKey)}
              accessibilityLabel={translate('settings.contentLanguage.option', {
                name: translate(`language.${locale}` as StringKey),
              })}
              selected={state.contentLocale === locale}
              disabled={pending !== undefined}
              onPress={() =>
                void updateLanguage('content', () =>
                  state.setContentLocale(locale),
                )
              }
            />
          ))}
        </View>
        {languageMessage ? (
          <ActionMessage
            message={languageMessage.text}
            tone={languageMessage.tone}
          />
        ) : null}

        <Text allowFontScaling style={typography.sectionLabel}>
          {translate('settings.about.label')}
        </Text>
        <View style={styles.list}>
          <InfoRow
            label={translate('settings.licences.label')}
            value={translate('settings.licences.hint')}
          />
          <InfoRow
            label={translate('settings.version.label')}
            value={translate('settings.version.value', { version })}
          />
          {/* Which JS this install is running, so an over-the-air update can be
              confirmed from the device instead of from a cable. */}
          <InfoRow
            label={translate('settings.update.label')}
            value={update ?? translate('settings.update.embedded')}
          />
          <InfoRow
            label={translate('settings.runtime.label')}
            value={runtime ?? translate('settings.update.unknown')}
          />
        </View>
        <Text allowFontScaling style={styles.about}>
          {translate('settings.about.message')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text allowFontScaling style={typography.rowLabel}>
        {label}
      </Text>
      <Text allowFontScaling style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  content: {
    gap: 10,
    paddingBottom: spacing.x4,
    paddingHorizontal: spacing.x2 + 2,
    paddingTop: spacing.x1,
  },
  offline: {
    backgroundColor: colors.accentWash,
    borderColor: 'rgba(232, 180, 76, 0.22)',
    borderRadius: spacing.radius,
    borderWidth: 1,
    gap: spacing.x1,
    marginBottom: 6,
    padding: 14,
  },
  offlineHead: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  offlineTitle: { ...typography.chip, fontSize: 13 },
  offlineBody: { ...typography.caption, fontSize: 11, lineHeight: 17 },
  list: { marginBottom: 6 },
  divider: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    height: 1,
  },
  infoRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.x2,
    justifyContent: 'space-between',
    minHeight: spacing.control,
    paddingVertical: spacing.x1,
  },
  infoValue: {
    ...typography.rowValue,
    flexShrink: 1,
    textAlign: 'right',
  },
  description: { ...typography.caption, fontSize: 12 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x1 },
  about: { ...typography.caption, fontSize: 11, marginTop: spacing.x1 },
});
