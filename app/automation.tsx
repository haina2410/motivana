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
import {
  configureRotation,
  runRotationNow,
} from '../src/services/wallpaperNative';
import { getQuoteById } from '../src/features/quotes/quoteRepository';
import type { WallpaperAutomationAvailability } from '../src/services/wallpaperAvailability';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';
import { router } from 'expo-router';
import type {
  RotationIntervalHours,
  WallpaperTarget,
} from '../src/store/schema';

function Choice({
  label,
  selected,
  disabled = false,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choice,
        selected && styles.selected,
        disabled && styles.disabled,
      ]}
    >
      <Text allowFontScaling style={styles.choiceText}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function AutomationScreen() {
  const state = useAppStore();
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
  const [message, setMessage] = useState<string>();
  const refresh = () =>
    getWallpaperAutomationAvailability()
      .then(setAvailability)
      .catch(() => setAvailability(wallpaperAutomationFallback));
  const save = async () => {
    if (favoritesOnly && state.favoriteQuoteIds.length === 0) {
      setMessage('Add a favorite before using favorites-only rotation.');
      return;
    }
    try {
      await configureRotation({
        enabled,
        intervalHours: interval,
        target,
        selectedPresetId: state.selectedPresetId,
        randomizePreset: state.randomizePreset,
        favoriteQuoteIds: state.favoriteQuoteIds,
        favoriteQuotesOnly: favoritesOnly,
      });
      state.setRotationConfiguration({
        enabled,
        intervalHours: interval,
        target,
      });
      if (favoritesOnly !== state.favoriteQuotesOnly)
        state.setFavoriteQuotesOnly(favoritesOnly);
      setMessage(enabled ? 'Rotation scheduled.' : 'Rotation disabled.');
      refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not update rotation.',
      );
    }
  };
  const runNow = async () => {
    try {
      await runRotationNow();
      setMessage('Rotation started.');
      refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not run rotation.',
      );
    }
  };
  const lastQuote = availability?.status.lastQuoteId
    ? getQuoteById(availability.status.lastQuoteId)
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
              AUTOMATION
            </Text>
            <Text allowFontScaling style={typography.screenTitle}>
              Rotation
            </Text>
          </View>
          <AppIconButton
            label="Back to Home"
            hint="Returns to the wallpaper preview."
            onPress={() => router.back()}
            symbol="‹"
          />
        </View>
        <ActionMessage
          title="Wallpaper targets available"
          message="Rotation runs at an approximate interval; Android may defer work to preserve battery."
        />
        <View
          accessible
          accessibilityLabel={`Service status ${availability?.status.state ?? 'loading'} ${availability?.status.intervalHours ?? ''} ${availability?.status.target ?? ''}`}
          style={styles.status}
        >
          <Text allowFontScaling style={styles.statusText}>
            Capability: {availability?.capabilities.kind ?? 'loading'}
          </Text>
          <Text allowFontScaling style={styles.statusText}>
            {availability?.status.label ?? 'Status: checking device support'}
          </Text>
          <Text allowFontScaling style={styles.statusText}>
            Approximate schedule: every{' '}
            {availability?.status.intervalHours ?? interval} hours on{' '}
            {availability?.status.target ?? target}.
          </Text>
          {availability?.status.lastAppliedAt ? (
            <Text allowFontScaling style={styles.statusText}>
              Last applied:{' '}
              {new Date(availability.status.lastAppliedAt).toLocaleString()}
            </Text>
          ) : null}
          {availability?.status.lastQuoteId ? (
            <Text allowFontScaling style={styles.statusText}>
              Last quote: {lastQuote?.text ?? 'saved quote'}
            </Text>
          ) : null}
          {availability?.status.errorCode ? (
            <Text allowFontScaling style={styles.statusText}>
              Last error: {availability.status.errorCode}
            </Text>
          ) : null}
        </View>
        <View style={styles.section}>
          <Text allowFontScaling style={styles.label}>
            Every
          </Text>
          <View style={styles.choices}>
            {([6, 12, 24] as const).map((hours) => (
              <Choice
                key={hours}
                label={`Every ${hours} hours`}
                selected={interval === hours}
                onPress={() => setInterval(hours)}
              />
            ))}
          </View>
        </View>
        <View style={styles.section}>
          <Text allowFontScaling style={styles.label}>
            Apply to
          </Text>
          <View style={styles.choices}>
            {(
              [
                ['home', 'Apply to Home screen'],
                ['lock', 'Apply to Lock screen'],
                ['both', 'Apply to both screens'],
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
          label="Enable automatic rotation"
          description="Apply a new wallpaper on the selected schedule."
          value={enabled}
          onValueChange={setEnabled}
        />
        <SettingRow
          label="Use favorite quotes only"
          description="Rotation will use only your saved quotes."
          value={favoritesOnly}
          onValueChange={setFavoritesOnly}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save automation preferences"
          disabled={!availability}
          onPress={save}
          style={styles.save}
        >
          <Text allowFontScaling style={typography.button}>
            Save automation preferences
          </Text>
        </Pressable>
        {__DEV__ ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Run rotation now"
            disabled={!availability || !enabled}
            onPress={runNow}
            style={styles.save}
          >
            <Text allowFontScaling style={typography.button}>
              Run rotation now
            </Text>
          </Pressable>
        ) : null}
        {message ? (
          <ActionMessage
            tone={
              message.startsWith('Add') || message.startsWith('Could')
                ? 'error'
                : 'default'
            }
            message={message}
          />
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
