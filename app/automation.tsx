import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMessage } from '../src/components/ActionMessage';
import { AppButton } from '../src/components/AppButton';
import { DeckTabBar } from '../src/components/DeckTabBar';
import { Icon } from '../src/components/Icon';
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
  WallpaperAutomationStatus,
} from '../src/services/wallpaperAvailability';
import type { StringKey } from '../src/features/i18n/t';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
import type {
  RotationIntervalHours,
  WallpaperTarget,
} from '../src/store/schema';

const stateKeys: Record<WallpaperAutomationStatus['state'], StringKey> = {
  disabled: 'automation.state.disabled',
  scheduled: 'automation.state.scheduled',
  running: 'automation.state.running',
  succeeded: 'automation.state.succeeded',
  failed: 'automation.state.failed',
};
const capabilityKeys: Record<'available' | 'unavailable', StringKey> = {
  available: 'automation.capability.available',
  unavailable: 'automation.capability.unavailable',
};
const targetKeys: Record<WallpaperTarget, StringKey> = {
  home: 'automation.targetName.home',
  lock: 'automation.targetName.lock',
  both: 'automation.targetName.both',
};

/** Screen 1i of the board. */
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
      intervalHours: interval,
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
  const statusText =
    availability === undefined
      ? translate('automation.status.loading')
      : translate(stateKeys[availability.status.state]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title={translate('automation.title')} />

        <View style={styles.card}>
          <Toggle
            label={translate('automation.enable.label')}
            description={translate('rotation.enable.description')}
            value={enabled}
            onValueChange={setEnabled}
          />
        </View>

        <Text allowFontScaling style={typography.sectionLabel}>
          {translate('automation.interval.label')}
        </Text>
        <Segmented
          onSelect={setInterval}
          options={([6, 12, 24] as const).map((hours) => ({
            value: hours,
            label: translate('rotation.interval.option', { hours }),
            accessibilityLabel: translate('automation.interval.option', {
              hours,
            }),
          }))}
          selected={interval}
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

        <View style={styles.runs}>
          <RunRow
            label={translate('automation.available.title')}
            value={translate('automation.status.capability', {
              kind:
                availability === undefined
                  ? translate('automation.status.loading')
                  : translate(capabilityKeys[availability.capabilities.kind]),
            })}
          />
          <RunRow
            label={translate('rotation.runs.lastRun')}
            value={
              availability?.status.lastAppliedAt
                ? new Date(availability.status.lastAppliedAt).toLocaleString(
                    state.appLocale,
                  )
                : translate('rotation.runs.pending')
            }
          />
          <RunRow
            label={translate('rotation.runs.nextRun')}
            value={translate('automation.status.schedule', {
              hours: availability?.status.intervalHours ?? interval,
              target: translate(
                targetKeys[availability?.status.target ?? target],
              ),
            })}
          />
          <RunRow
            label={translate('rotation.runs.status')}
            tone={availability?.status.state === 'failed' ? 'error' : 'success'}
            value={statusText}
          />
        </View>

        <View style={styles.warning}>
          <Icon name="triangle-exclamation" size={12} color={colors.accent} />
          <Text allowFontScaling style={styles.warningText}>
            {translate('rotation.battery')}
          </Text>
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
      <DeckTabBar active="rotate" />
    </SafeAreaView>
  );
}

function RunRow({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'error';
}) {
  return (
    <View style={styles.runRow}>
      <Text allowFontScaling style={styles.runLabel}>
        {label}
      </Text>
      <Text
        allowFontScaling
        style={[
          styles.runValue,
          tone === 'success' && styles.runSuccess,
          tone === 'error' && styles.runError,
        ]}
      >
        {value}
      </Text>
    </View>
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
  runs: {
    backgroundColor: colors.fillFaint,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    marginTop: 12,
    padding: 13,
  },
  runRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.x2,
    justifyContent: 'space-between',
  },
  runLabel: { ...typography.caption, fontSize: 12 },
  runValue: {
    ...typography.rowValue,
    color: colors.text,
    flexShrink: 1,
    fontSize: 12,
    textAlign: 'right',
  },
  runSuccess: { color: colors.success },
  runError: { color: colors.danger },
  warning: {
    backgroundColor: colors.accentWash,
    borderColor: colors.accentBorder,
    borderRadius: spacing.x1,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    padding: 12,
  },
  warningText: { ...typography.caption, flex: 1, fontSize: 11, lineHeight: 17 },
});
