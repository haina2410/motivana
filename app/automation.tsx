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
import type { RotationConfiguration } from '../src/store/useAppStore';
import { showToast } from '../src/store/useToastStore';
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
import { rotationSchedules } from '../src/features/rotation/schedule';

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
  const refresh = () =>
    getWallpaperAutomationAvailability()
      .then(setAvailability)
      .catch(() => setAvailability(wallpaperAutomationFallback));
  /**
   * Commits one control's change straight away. The store is the only copy of
   * these preferences, so a change native refuses leaves it untouched and the
   * control shows the stored value again without any rollback here.
   *
   * Only the on/off change reports a toast. It decides whether rotation runs at
   * all; a toast for every tap on a screen of toggles would bury it.
   */
  const apply = async (patch: Partial<RotationConfiguration>) => {
    const saved = await state.setRotationConfiguration({
      enabled: state.rotationEnabled,
      schedule: state.rotationSchedule,
      target,
      favoriteQuotesOnly: state.favoriteQuotesOnly,
      randomizePreset: state.randomizePreset,
      ...patch,
    });
    if (!saved) {
      showToast(translate('automation.save.error'), 'error');
      return;
    }
    if (patch.enabled !== undefined) {
      showToast(
        translate(
          patch.enabled ? 'automation.save.enabled' : 'automation.save.disabled',
        ),
      );
    }
    refresh();
  };
  const runNow = async () => {
    try {
      await runRotationNow();
      showToast(translate('automation.run.success'));
      refresh();
    } catch {
      showToast(translate('automation.run.error'), 'error');
    }
  };
  const statusRecovery = getRotationStatusRecovery(
    availability?.status.errorCode,
  );
  // A control appears only where retrying is the answer. Every other code is a
  // fault no preference can correct, so the card carries the message alone.
  const statusRecoveryControl = statusRecovery
    ? getRotationStatusRecoveryControl(statusRecovery, __DEV__)
    : undefined;
  const recover = () =>
    statusRecoveryControl?.operation === 'run-now' ? void runNow() : void apply({});
  const loading = !availability;
  const hasFavorites = state.favoriteQuoteIds.length > 0;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader back title={translate('automation.title')} />

        <View style={styles.card}>
          <Toggle
            disabled={loading}
            label={translate('automation.enable.label')}
            value={state.rotationEnabled}
            onValueChange={(enabled) => void apply({ enabled })}
          />
        </View>

        <Text allowFontScaling style={typography.sectionLabel}>
          {translate('automation.schedule.label')}
        </Text>
        <Segmented
          onSelect={(schedule) => void apply({ schedule })}
          options={rotationSchedules.map((value) => ({
            value,
            label: translate(`rotation.schedule.${value}` as StringKey),
            accessibilityLabel: translate(
              `automation.schedule.${value}` as StringKey,
            ),
            disabled: loading,
          }))}
          selected={state.rotationSchedule}
        />

        <Text allowFontScaling style={typography.sectionLabel}>
          {translate('automation.target.label')}
        </Text>
        <Segmented
          onSelect={(value) => {
            setTarget(value);
            void apply({ target: value });
          }}
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
            disabled={loading || !hasFavorites}
            label={translate('rotation.source.saved')}
            onPress={() => void apply({ favoriteQuotesOnly: true })}
            selected={state.favoriteQuotesOnly}
          />
          <RadioRow
            disabled={loading}
            label={translate('rotation.source.all')}
            onPress={() => void apply({ favoriteQuotesOnly: false })}
            selected={!state.favoriteQuotesOnly}
          />
          {hasFavorites ? null : (
            <Text allowFontScaling style={styles.hint}>
              {translate('automation.favoritesOnly.empty')}
            </Text>
          )}
        </View>

        <Text allowFontScaling style={typography.sectionLabel}>
          {translate('rotation.style.label')}
        </Text>
        <View style={styles.card}>
          <Toggle
            disabled={loading}
            label={translate('rotation.randomize.label')}
            description={translate('rotation.randomize.description')}
            value={state.randomizePreset}
            onValueChange={(randomizePreset) => void apply({ randomizePreset })}
          />
        </View>

        {statusRecovery ? (
          <ActionMessage
            tone="error"
            title={translate('automation.attention.title')}
            message={translate(statusRecovery.messageKey)}
          />
        ) : null}
        {statusRecoveryControl ? (
          <AppButton
            hint={translate(statusRecoveryControl.hintKey)}
            icon="rotate-right"
            label={translate(statusRecoveryControl.labelKey)}
            onPress={recover}
            variant="outline"
          />
        ) : null}
        {__DEV__ ? (
          <AppButton
            disabled={loading || !state.rotationEnabled}
            label={translate('automation.run')}
            onPress={runNow}
            variant="outline"
          />
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
  hint: { color: colors.faintText, fontSize: 13, lineHeight: 18 },
});
