import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ActionMessage } from '../src/components/ActionMessage';
import { AppIconButton } from '../src/components/AppIconButton';
import { SettingRow } from '../src/components/SettingRow';
import { useAppStore } from '../src/store/useAppStore';
import { getPresetById } from '../src/features/wallpaper/presetRepository';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';

export default function SettingsScreen() {
  const state = useAppStore();
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
                ? 'Random preset preference updated.'
                : 'Favorite quote preference updated.',
          }
        : {
            message: 'Could not update rotation preferences. Try again.',
            retry: { kind, value },
          },
    );
  };
  const preset = getPresetById(state.selectedPresetId);
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text allowFontScaling style={typography.eyebrow}>
              KEEP IT YOURS
            </Text>
            <Text allowFontScaling style={typography.screenTitle}>
              Settings
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
          title="Current preset"
          message={preset?.name ?? 'Choose a wallpaper preset.'}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Customize preset"
          accessibilityHint="Opens Customize to choose your preferred wallpaper preset."
          onPress={() => router.push('/customize')}
          style={styles.customize}
        >
          <Text allowFontScaling style={typography.button}>
            Customize preset
          </Text>
        </Pressable>
        <SettingRow
          label="Randomize preset"
          description="Use a different curated style when rotation becomes available."
          value={state.randomizePreset}
          disabled={pending !== undefined}
          onValueChange={(value) => void updatePreference('randomize', value)}
        />
        <SettingRow
          label="Use favorite quotes only"
          description="Keep future rotation focused on saved quotes."
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
            label="Retry preference update"
            hint="Retries updating the preference used by wallpaper rotation."
            onPress={() =>
              void updatePreference(feedback.retry!.kind, feedback.retry!.value)
            }
            symbol="↻"
          />
        ) : null}
        <ActionMessage
          title="About Motivana"
          message="Create a focused wallpaper from a thought worth returning to."
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
