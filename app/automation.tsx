import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMessage } from '../src/components/ActionMessage';
import { AppIconButton } from '../src/components/AppIconButton';
import { SettingRow } from '../src/components/SettingRow';
import { useAppStore } from '../src/store/useAppStore';
import {
  getWallpaperAutomationAvailability,
  isWallpaperTargetAvailable,
  wallpaperAutomationFallback,
} from '../src/services/wallpaperAvailability';
import { runRotationNow } from '../src/services/wallpaperNative';
import {
  getRotationStatusRecovery,
  getRotationStatusRecoveryControl,
} from '../src/services/rotationStatus';
import {
  getQuoteById,
  favoriteQuoteText,
} from '../src/features/quotes/quoteRepository';
import { Choice } from '../src/components/Choice';
import { useTranslate } from '../src/features/i18n/useTranslate';
import type {
  WallpaperAutomationAvailability,
  WallpaperAutomationStatus,
} from '../src/services/wallpaperAvailability';
import type { StringKey } from '../src/features/i18n/t';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
import { router } from 'expo-router';
import type {
  RotationIntervalHours,
  WallpaperTarget,
} from '../src/store/schema';

export default function AutomationScreen() {
  const state = useAppStore();
  const translate = useTranslate();
  const [availability, setAvailability] =
    useState<WallpaperAutomationAvailability>();
  const [target, setTarget] = useState<WallpaperTarget>('home');
  const [persistedTarget] = useState<WallpaperTarget>(state.wallpaperTarget);
  useEffect(() => {
    let active = true;
    getWallpaperAutomationAvailability()
      .then((value) => {
        if (!active) return;
        setAvailability(value);
        setTarget((current) =>
          isWallpaperTargetAvailable(persistedTarget, value.capabilities)
            ? persistedTarget
            : isWallpaperTargetAvailable(current, value.capabilities)
              ? current
              : 'home',
        );
      })
      .catch(() => active && setAvailability(wallpaperAutomationFallback));
    return () => {
      active = false;
    };
  }, [persistedTarget]);
  const [interval, setInterval] = useState<RotationIntervalHours>(
    state.rotationIntervalHours,
  );
  const [favoritesOnly, setFavoritesOnly] = useState(state.favoriteQuotesOnly);
  const [enabled, setEnabled] = useState(state.rotationEnabled);
  const [message, setMessage] = useState<
    { text: string; tone: 'default' | 'error' } | undefined
  >();
  const refresh = () =>
    getWallpaperAutomationAvailability()
      .then(setAvailability)
      .catch(() => setAvailability(wallpaperAutomationFallback));
  const save = async (nextFavoritesOnly = favoritesOnly) => {
    if (nextFavoritesOnly && state.favoriteQuoteIds.length === 0) {
      setMessage({
        text: translate('automation.favoritesOnly.error'),
        tone: 'error',
      });
      return;
    }
    const saved = await state.setRotationConfiguration({
      enabled,
      intervalHours: interval,
      target,
      favoriteQuotesOnly: nextFavoritesOnly,
    });
    if (!saved) {
      setMessage({ text: translate('automation.save.error'), tone: 'error' });
      return;
    }
    setMessage({
      text: enabled
        ? translate('automation.save.enabled')
        : translate('automation.save.disabled'),
      tone: 'default',
    });
    refresh();
  };
  const runNow = async () => {
    try {
      await runRotationNow();
      setMessage({
        text: translate('automation.run.success'),
        tone: 'default',
      });
      refresh();
    } catch {
      setMessage({ text: translate('automation.run.error'), tone: 'error' });
    }
  };
  const lastQuote = availability?.status.lastQuoteId
    ? getQuoteById(availability.status.lastQuoteId)
    : undefined;
  const stateText = (
    state: WallpaperAutomationStatus['state'] | undefined,
  ): string =>
    state === undefined
      ? translate('automation.status.loading')
      : translate(`automation.state.${state}` as StringKey);
  const targetText = (target: WallpaperTarget): string =>
    translate(`automation.targetName.${target}` as StringKey);
  const capabilityText = (
    kind: 'available' | 'unavailable' | undefined,
  ): string =>
    kind === undefined
      ? translate('automation.status.loading')
      : translate(`automation.capability.${kind}` as StringKey);
  const statusRecovery = getRotationStatusRecovery(
    availability?.status.errorCode,
  );
  const statusRecoveryControl = statusRecovery
    ? getRotationStatusRecoveryControl(statusRecovery, __DEV__)
    : undefined;
  const recoverFromStatusFailure = () => {
    if (
      availability?.status.errorCode === 'EMPTY_FAVORITES' ||
      availability?.status.errorCode === 'NO_ELIGIBLE_QUOTES'
    ) {
      setFavoritesOnly(false);
      void save(false);
      return;
    }
    if (statusRecoveryControl?.operation === 'run-now') {
      void runNow();
      return;
    }
    void save();
  };
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text allowFontScaling style={typography.eyebrow}>
              {translate('automation.eyebrow')}
            </Text>
            <Text allowFontScaling style={typography.screenTitle}>
              {translate('automation.title')}
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
          title={translate('automation.available.title')}
          message={translate('automation.available.message')}
        />
        <View
          accessible
          accessibilityLabel={translate('automation.status.label', {
            state: stateText(availability?.status.state),
            intervalHours: availability?.status.intervalHours ?? '',
            target: availability?.status.target
              ? targetText(availability.status.target)
              : '',
          })}
          style={styles.status}
        >
          <Text allowFontScaling style={styles.statusText}>
            {translate('automation.status.capability', {
              kind: capabilityText(availability?.capabilities.kind),
            })}
          </Text>
          <Text allowFontScaling style={styles.statusText}>
            {availability === undefined
              ? translate('automation.status.checking')
              : translate('automation.status.value', {
                  state: stateText(availability.status.state),
                })}
          </Text>
          <Text allowFontScaling style={styles.statusText}>
            {translate('automation.status.schedule', {
              hours: availability?.status.intervalHours ?? interval,
              target: targetText(availability?.status.target ?? target),
            })}
          </Text>
          {availability?.status.lastAppliedAt ? (
            <Text allowFontScaling style={styles.statusText}>
              {translate('automation.status.lastApplied', {
                date: new Date(
                  availability.status.lastAppliedAt,
                ).toLocaleString(state.appLocale),
              })}
            </Text>
          ) : null}
          {availability?.status.lastQuoteId ? (
            <Text allowFontScaling style={styles.statusText}>
              {translate('automation.lastQuote', {
                text: lastQuote
                  ? favoriteQuoteText(lastQuote, state.contentLocale)
                  : translate('automation.lastQuote.fallback'),
              })}
            </Text>
          ) : null}
          {statusRecovery ? (
            <ActionMessage
              tone="error"
              title={translate('automation.attention.title')}
              message={translate(statusRecovery.messageKey)}
            />
          ) : null}
        </View>
        <SettingRow
          label={translate('automation.enable.label')}
          description={translate('automation.enable.description')}
          value={enabled}
          onValueChange={setEnabled}
        />
        <View style={styles.section}>
          <Text allowFontScaling style={styles.label}>
            {translate('automation.interval.label')}
          </Text>
          <View style={styles.choices}>
            {([6, 12, 24] as const).map((hours) => (
              <Choice
                key={hours}
                label={translate('automation.interval.option', { hours })}
                selected={interval === hours}
                onPress={() => setInterval(hours)}
              />
            ))}
          </View>
        </View>
        <View style={styles.section}>
          <Text allowFontScaling style={styles.label}>
            {translate('automation.target.label')}
          </Text>
          <View style={styles.choices}>
            {(
              [
                ['home', translate('automation.target.home')],
                ['lock', translate('automation.target.lock')],
                ['both', translate('automation.target.both')],
              ] as const
            ).map(([value, label]) => (
              <Choice
                key={value}
                label={label}
                selected={target === value}
                disabled={
                  !availability ||
                  !isWallpaperTargetAvailable(value, availability.capabilities)
                }
                onPress={() => setTarget(value)}
              />
            ))}
          </View>
        </View>
        <SettingRow
          label={translate('automation.favoritesOnly.label')}
          description={translate('automation.favoritesOnly.description')}
          value={favoritesOnly}
          onValueChange={setFavoritesOnly}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate('automation.save')}
          disabled={!availability}
          onPress={() => void save()}
          style={styles.save}
        >
          <Text allowFontScaling style={typography.button}>
            {translate('automation.save')}
          </Text>
        </Pressable>
        {__DEV__ ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={translate('automation.run')}
            disabled={!availability || !enabled}
            onPress={runNow}
            style={styles.save}
          >
            <Text allowFontScaling style={typography.button}>
              {translate('automation.run')}
            </Text>
          </Pressable>
        ) : null}
        {statusRecovery ? (
          <AppIconButton
            hint={translate(statusRecoveryControl!.hintKey)}
            label={translate(statusRecoveryControl!.labelKey)}
            onPress={recoverFromStatusFailure}
            symbol="↻"
          />
        ) : null}
        {message ? (
          <ActionMessage tone={message.tone} message={message.text} />
        ) : null}
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
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  status: { gap: spacing.x1, minWidth: 0 },
  statusText: { color: colors.mutedText, fontSize: 13, flexShrink: 1 },
  section: { gap: spacing.x1 },
  label: { color: colors.text, fontSize: 16, fontWeight: '700' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x1 },
  choice: {
    borderColor: colors.border,
    borderRadius: spacing.radius,
    borderWidth: 1,
    minHeight: spacing.control,
    paddingHorizontal: spacing.x2,
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.accent,
  },
  disabled: { opacity: 0.48 },
  choiceText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  save: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: spacing.radius,
    justifyContent: 'center',
    minHeight: spacing.control,
    paddingHorizontal: spacing.x2,
  },
});
