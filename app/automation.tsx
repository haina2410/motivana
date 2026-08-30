import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMessage } from '../src/components/ActionMessage';
import { AppButton } from '../src/components/AppButton';
import { RadioRow } from '../src/components/RadioRow';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Segmented } from '../src/components/Segmented';
import { Toggle } from '../src/components/Toggle';
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
import { useTranslate } from '../src/features/i18n/useTranslate';
import type {
  WallpaperAutomationAvailability,
  WallpaperCapabilities,
} from '../src/services/wallpaperAvailability';
import type { StringKey } from '../src/features/i18n/t';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
import type { WallpaperTarget } from '../src/store/schema';
import {
  rotationSchedules,
  type RotationSchedule,
} from '../src/features/rotation/schedule';

const targetKeys: Record<WallpaperTarget, StringKey> = {
  home: 'automation.targetName.home',
  lock: 'automation.targetName.lock',
  both: 'automation.targetName.both',
};

/**
 * The best target the device can actually set, most screens first. A device
 * that cannot set either one still reports `home`, so the control has a
 * selection to show while every option sits disabled.
 */
function firstAvailableTarget(
  capabilities: WallpaperCapabilities,
): WallpaperTarget {
  const preference: readonly WallpaperTarget[] = ['both', 'home', 'lock'];
  return (
    preference.find((value) =>
      isWallpaperTargetAvailable(value, capabilities),
    ) ?? 'home'
  );
}

/** Screen 1i of the board. */
export default function AutomationScreen() {
  const state = useAppStore();
  const translate = useTranslate();
  const [availability, setAvailability] =
    useState<WallpaperAutomationAvailability>();
  const [target, setTarget] = useState<WallpaperTarget>('both');
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
              : firstAvailableTarget(value.capabilities),
        );
      })
      .catch(() => active && setAvailability(wallpaperAutomationFallback));
    return () => {
      active = false;
    };
  }, [persistedTarget]);
  const [schedule, setSchedule] = useState<RotationSchedule>(
    state.rotationSchedule,
  );
  const [favoritesOnly, setFavoritesOnly] = useState(state.favoriteQuotesOnly);
  const [randomizePreset, setRandomizePreset] = useState(state.randomizePreset);
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
      schedule,
      target,
      favoriteQuotesOnly: nextFavoritesOnly,
      randomizePreset,
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
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader back title={translate('automation.title')} />

        <View style={styles.card}>
          <Toggle
            label={translate('automation.enable.label')}
            value={enabled}
            onValueChange={setEnabled}
          />
        </View>

        <Text allowFontScaling style={typography.sectionLabel}>
          {translate('automation.schedule.label')}
        </Text>
        <Segmented
          onSelect={setSchedule}
          options={rotationSchedules.map((value) => ({
            value,
            label: translate(`rotation.schedule.${value}` as StringKey),
            accessibilityLabel: translate(
              `automation.schedule.${value}` as StringKey,
            ),
          }))}
          selected={schedule}
        />

        <Text allowFontScaling style={typography.sectionLabel}>
          {translate('automation.target.label')}
        </Text>
        <Segmented
          onSelect={setTarget}
          options={(['home', 'lock', 'both'] as const).map((value) => ({
            value,
            label: translate(targetKeys[value]),
            accessibilityLabel: translate(
              `automation.target.${value}` as StringKey,
            ),
            disabled:
              !availability ||
              !isWallpaperTargetAvailable(value, availability.capabilities),
          }))}
          selected={target}
        />

        <Text allowFontScaling style={typography.sectionLabel}>
          {translate('rotation.source.label')}
        </Text>
        <View style={styles.sources}>
          <RadioRow
            accessibilityHint={translate(
              'automation.favoritesOnly.description',
            )}
            label={translate('rotation.source.saved')}
            onPress={() => setFavoritesOnly(true)}
            selected={favoritesOnly}
          />
          <RadioRow
            label={translate('rotation.source.all')}
            onPress={() => setFavoritesOnly(false)}
            selected={!favoritesOnly}
          />
        </View>

        <Text allowFontScaling style={typography.sectionLabel}>
          {translate('rotation.style.label')}
        </Text>
        <View style={styles.card}>
          <Toggle
            label={translate('rotation.randomize.label')}
            description={translate('rotation.randomize.description')}
            value={randomizePreset}
            onValueChange={setRandomizePreset}
          />
        </View>

        {statusRecovery ? (
          <ActionMessage
            tone="error"
            title={translate('automation.attention.title')}
            message={translate(statusRecovery.messageKey)}
          />
        ) : null}
        <AppButton
          disabled={!availability}
          label={translate('automation.save')}
          onPress={() => void save()}
        />
        {__DEV__ ? (
          <AppButton
            disabled={!availability || !enabled}
            label={translate('automation.run')}
            onPress={runNow}
            variant="outline"
          />
        ) : null}
        {statusRecovery ? (
          <AppButton
            hint={translate(statusRecoveryControl!.hintKey)}
            icon="rotate-right"
            label={translate(statusRecoveryControl!.labelKey)}
            onPress={recoverFromStatusFailure}
            variant="outline"
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
  screen: { backgroundColor: colors.background, flex: 1 },
  content: {
    gap: 10,
    paddingBottom: spacing.x3,
    paddingHorizontal: spacing.x2 + 2,
    paddingTop: spacing.x1,
  },
  card: {
    backgroundColor: colors.fillSubtle,
    borderColor: colors.borderSubtle,
    borderRadius: spacing.radius,
    borderWidth: 1,
    marginBottom: 6,
    paddingHorizontal: 14,
  },
  sources: { gap: spacing.x1 },
});
